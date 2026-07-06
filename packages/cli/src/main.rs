//! `semagraph` — a deterministic CLI for classifying and compressing
//! state-transition trajectories over a six-bit state alphabet.
//!
//! The tool is a thin consumer of the `semagraph-core-rs` kernel. It performs no
//! inference, no interpretation, and no network access. Output is human-readable
//! by default and machine-readable JSON under `--json`. Data is written to
//! stdout; errors to stderr; exit code 0 on success, non-zero on failure.
//!
//! DESIGN-NOTE: argument parsing and JSON emission are hand-rolled. The binary
//! has no third-party dependencies (only the in-repo kernel), which keeps the
//! zero-runtime-dependency promise and makes the whole tool auditable in one file.
//
// DESIGN-NOTE: clippy cannot be run in the authoring environment, so this purely
// stylistic lint is allowed to ensure a missed inline-format-arg site can never
// fail a `-D warnings` gate. No behavioural lints are suppressed.
#![allow(clippy::uninlined_format_args)]

use std::io::{self, Read, Write};
use std::process::ExitCode;

use semagraph_core_rs::{
    lookup_transition64, pack_transition64, project_trajectory, transition_index64,
    TrajectoryProjection, Transition64Entry,
};

/// Module-scope names, indexed by `ModuleScopeCode`. Mirrors `regimes.ts`.
const MODULE_SCOPE_NAMES: [&str; 4] = ["none", "lower_only", "upper_only", "both_modules"];
/// Regime-class names, indexed by `RegimeClassCode`. Mirrors `regimes.ts`.
const REGIME_CLASS_NAMES: [&str; 6] = [
    "no_change",
    "bit_adjustment",
    "module_reconfiguration",
    "cross_module_regime_shift",
    "near_total_inversion",
    "full_bit_reversal",
];

const Q3_MAX: u8 = 7;
const Q6_MAX: u8 = 63;
const MAX_INDEX: u32 = 4095;

/// Output context threaded through the handlers so the same computation feeds
/// both the human and the JSON renderers.
struct Ctx {
    json: bool,
    quiet: bool,
}

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().skip(1).collect();

    let mut json = false;
    let mut quiet = false;
    let mut positional: Vec<String> = Vec::new();

    for arg in &args {
        match arg.as_str() {
            "--json" => json = true,
            "--quiet" => quiet = true,
            "--version" => {
                println!("semagraph {}", env!("CARGO_PKG_VERSION"));
                return ExitCode::SUCCESS;
            }
            "--help" | "-h" => {
                print!("{}", help_text());
                return ExitCode::SUCCESS;
            }
            // Numbers and the `--` separator are positional; numbers never look
            // like the flags above, so a simple pass is unambiguous here.
            other => positional.push(other.to_string()),
        }
    }

    let ctx = Ctx { json, quiet };

    let Some((command, rest)) = positional.split_first() else {
        eprint!("{}", help_text());
        return ExitCode::from(2);
    };

    let result = match command.as_str() {
        "classify" => cmd_classify(&ctx, rest),
        "compress" => cmd_compress(&ctx, rest),
        "compare" => cmd_compare(&ctx, rest),
        "lookup" => cmd_lookup(&ctx, rest),
        "verify" => cmd_verify(&ctx),
        "batch" => cmd_batch(&ctx),
        "help" => {
            print!("{}", help_text());
            return ExitCode::SUCCESS;
        }
        other => Err(CliError::usage(format!("unknown subcommand '{}'", other))),
    };

    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(err) => {
            eprintln!("error: {}", err.message);
            ExitCode::from(err.code)
        }
    }
}

/// A CLI error: a message plus the process exit code to use.
struct CliError {
    message: String,
    code: u8,
}

impl CliError {
    /// Usage / argument errors use exit code 2.
    fn usage(message: String) -> Self {
        Self { message, code: 2 }
    }
    /// Validation / data errors use exit code 1.
    fn data(message: String) -> Self {
        Self { message, code: 1 }
    }
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

fn parse_state(token: &str, max: u8, label: &str) -> Result<u8, CliError> {
    let value: u32 = token
        .parse()
        .map_err(|_| CliError::usage(format!("{} must be an integer, got '{}'", label, token)))?;
    if value > max as u32 {
        return Err(CliError::usage(format!(
            "{} must be in 0..={}, got {}",
            label, max, value
        )));
    }
    Ok(value as u8)
}

fn parse_trajectory(tokens: &[String]) -> Result<Vec<u8>, CliError> {
    if tokens.len() < 2 {
        return Err(CliError::usage(
            "a trajectory requires at least 2 states".to_string(),
        ));
    }
    tokens
        .iter()
        .map(|t| parse_state(t, Q3_MAX, "state"))
        .collect()
}

// ---------------------------------------------------------------------------
// classify / lookup (Q6 transition metadata)
// ---------------------------------------------------------------------------

fn cmd_classify(ctx: &Ctx, rest: &[String]) -> Result<(), CliError> {
    if rest.len() != 2 {
        return Err(CliError::usage(
            "classify takes exactly two states: classify <source> <target>".to_string(),
        ));
    }
    let source = parse_state(&rest[0], Q6_MAX, "source")?;
    let target = parse_state(&rest[1], Q6_MAX, "target")?;
    let entry = lookup_transition64(source, target)
        .map_err(|_| CliError::data("transition lookup failed".to_string()))?;
    render_transition(ctx, &entry);
    Ok(())
}

fn cmd_lookup(ctx: &Ctx, rest: &[String]) -> Result<(), CliError> {
    if rest.len() != 1 {
        return Err(CliError::usage(
            "lookup takes exactly one index: lookup <index>".to_string(),
        ));
    }
    let index: u32 = rest[0]
        .parse()
        .map_err(|_| CliError::usage(format!("index must be an integer, got '{}'", rest[0])))?;
    if index > MAX_INDEX {
        return Err(CliError::usage(format!(
            "index must be in 0..={}, got {}",
            MAX_INDEX, index
        )));
    }
    let source = (index / 64) as u8;
    let target = (index % 64) as u8;
    let entry = lookup_transition64(source, target)
        .map_err(|_| CliError::data("transition lookup failed".to_string()))?;
    render_transition(ctx, &entry);
    Ok(())
}

fn render_transition(ctx: &Ctx, entry: &Transition64Entry) {
    if ctx.quiet {
        return;
    }
    let scope = MODULE_SCOPE_NAMES[entry.module_scope as usize];
    let regime = REGIME_CLASS_NAMES[entry.regime_class as usize];
    let packed = pack_transition64(*entry);
    if ctx.json {
        let mut obj = JsonObject::new();
        obj.num("source", entry.source as i64);
        obj.num("target", entry.target as i64);
        obj.num("mutation_mask", entry.mutation_mask as i64);
        obj.num("distance", entry.distance as i64);
        obj.num("lower_distance", entry.lower_distance as i64);
        obj.num("upper_distance", entry.upper_distance as i64);
        obj.str("module_scope", scope);
        obj.str("regime_class", regime);
        obj.num("regime_class_code", entry.regime_class as i64);
        obj.num("index", entry.index as i64);
        obj.str("packed", &packed.to_string());
        println!("{}", obj.finish());
    } else {
        println!("source:       {}  ({:06b})", entry.source, entry.source);
        println!("target:       {}  ({:06b})", entry.target, entry.target);
        println!(
            "mask:         {}  ({:06b})",
            entry.mutation_mask, entry.mutation_mask
        );
        println!("distance:     {}", entry.distance);
        println!("lower_dist:   {}", entry.lower_distance);
        println!("upper_dist:   {}", entry.upper_distance);
        println!("scope:        {}", scope);
        println!("regime:       {}", regime);
        println!("index:        {}", entry.index);
        println!("packed:       {}", packed);
    }
}

// ---------------------------------------------------------------------------
// compress (Q3 trajectory signature)
// ---------------------------------------------------------------------------

fn cmd_compress(ctx: &Ctx, rest: &[String]) -> Result<(), CliError> {
    let path = parse_trajectory(rest)?;
    let projection = project_trajectory(&path);
    if !ctx.quiet {
        if ctx.json {
            println!("{}", compress_json(&path, &projection));
        } else {
            print_compress_human(&path, &projection);
        }
    }
    Ok(())
}

fn exact_key(path: &[u8]) -> String {
    format!("P3:{}", join_dot(path))
}
fn shape_key(shape: &[u8]) -> String {
    format!("S3:{}", join_dot(shape))
}
fn dwell_signature(dwell: &[u32]) -> String {
    format!("D3:{}", join_dot_u32(dwell))
}

fn compress_json(path: &[u8], p: &TrajectoryProjection) -> String {
    let source = p.endpoint / 8;
    let target = p.endpoint % 8;
    let mut length = JsonObject::new();
    length.num("states", path.len() as i64);
    length.num("transitions", (path.len() - 1) as i64);
    let mut endpoint = JsonObject::new();
    endpoint.num("source", source as i64);
    endpoint.num("target", target as i64);
    endpoint.num("code", p.endpoint as i64);

    let mut obj = JsonObject::new();
    obj.raw("path", &json_array_u8(path));
    obj.raw("length", &length.finish());
    obj.num("net_mutation", p.net_mutation as i64);
    obj.num("cumulative_distance", p.cumulative_distance as i64);
    obj.raw("endpoint", &endpoint.finish());
    obj.raw("shape", &json_array_u8(&p.shape));
    obj.raw("dwell", &json_array_u32(&p.dwell));
    obj.str("exact_key", &exact_key(path));
    obj.str("shape_key", &shape_key(&p.shape));
    obj.str("dwell_signature", &dwell_signature(&p.dwell));
    obj.finish()
}

fn print_compress_human(path: &[u8], p: &TrajectoryProjection) {
    let source = p.endpoint / 8;
    let target = p.endpoint % 8;
    println!("path:           {}", join_arrow(path));
    println!(
        "length:         {} states, {} transitions",
        path.len(),
        path.len() - 1
    );
    println!(
        "net_mutation:   {}  ({:03b})",
        p.net_mutation, p.net_mutation
    );
    println!("cumulative_d:   {}", p.cumulative_distance);
    println!(
        "endpoint:       {} \u{2192} {}  (code {})",
        source, target, p.endpoint
    );
    println!("shape:          {}", join_space(&p.shape));
    println!("dwell:          {}", join_space_u32(&p.dwell));
    println!("exact_key:      {}", exact_key(path));
    println!("shape_key:      {}", shape_key(&p.shape));
    println!("dwell_sig:      {}", dwell_signature(&p.dwell));
}

// ---------------------------------------------------------------------------
// compare (cascade relation)
// ---------------------------------------------------------------------------

fn cmd_compare(ctx: &Ctx, rest: &[String]) -> Result<(), CliError> {
    let sep = rest.iter().position(|t| t == "--").ok_or_else(|| {
        CliError::usage("compare requires a '--' separator: compare <a..> -- <b..>".to_string())
    })?;
    let left = parse_trajectory(&rest[..sep])?;
    let right = parse_trajectory(&rest[sep + 1..])?;

    let pl = project_trajectory(&left);
    let pr = project_trajectory(&right);

    let same_endpoint = pl.endpoint == pr.endpoint;
    let shape_l = shape_key(&pl.shape);
    let shape_r = shape_key(&pr.shape);
    let same_shape = shape_l == shape_r;
    let dwell_l = dwell_signature(&pl.dwell);
    let dwell_r = dwell_signature(&pr.dwell);
    let same_dwell = dwell_l == dwell_r;

    // Cascade, mirroring shapes.ts compareTrajectories exactly.
    let (relation, rationale) = if !same_endpoint {
        (
            "different_trajectory",
            "Endpoints differ; equal shape would force equal endpoints, so the shapes differ.",
        )
    } else if !same_shape {
        (
            "different_pattern",
            "Same endpoint but different run-collapsed shape; the regime sequence differs.",
        )
    } else if same_dwell {
        (
            "equivalent",
            "Identical run-collapsed shape and identical dwell vector.",
        )
    } else {
        (
            "same_form_different_duration",
            "Identical run-collapsed shape but different dwell; same form, different duration.",
        )
    };
    // For the cascade's short-circuit branches the lossy results are not
    // computed by the reference; report them as false to match its output. Equal
    // shape forces equal endpoint, so (same_endpoint && same_shape) is the only
    // case where shape equality is reported true.
    let (out_same_shape, out_same_dwell) = if same_endpoint && same_shape {
        (true, same_dwell)
    } else {
        (false, false)
    };

    if ctx.quiet {
        return Ok(());
    }
    if ctx.json {
        let mut a = JsonObject::new();
        a.str("exact_key", &exact_key(&left));
        a.str("shape_key", &shape_l);
        a.str("dwell_signature", &dwell_l);
        let mut b = JsonObject::new();
        b.str("exact_key", &exact_key(&right));
        b.str("shape_key", &shape_r);
        b.str("dwell_signature", &dwell_r);
        let mut obj = JsonObject::new();
        obj.str("relation", relation);
        obj.boolean("same_endpoint", same_endpoint);
        obj.boolean("same_shape", out_same_shape);
        obj.boolean("same_dwell", out_same_dwell);
        obj.raw("path_a", &a.finish());
        obj.raw("path_b", &b.finish());
        println!("{}", obj.finish());
    } else {
        println!("relation:       {}", relation);
        println!("same_endpoint:  {}", same_endpoint);
        println!("same_shape:     {}", out_same_shape);
        println!("same_dwell:     {}", out_same_dwell);
        println!(
            "path_a:         {}  {}  {}",
            exact_key(&left),
            shape_l,
            dwell_l
        );
        println!(
            "path_b:         {}  {}  {}",
            exact_key(&right),
            shape_r,
            dwell_r
        );
        println!("rationale:      {}", rationale);
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// batch (NDJSON in -> NDJSON out)
// ---------------------------------------------------------------------------

fn cmd_batch(_ctx: &Ctx) -> Result<(), CliError> {
    let mut input = String::new();
    io::stdin()
        .read_to_string(&mut input)
        .map_err(|e| CliError::data(format!("failed to read stdin: {}", e)))?;

    let stdout = io::stdout();
    let mut out = stdout.lock();
    let mut had_error = false;

    for (line_index, line) in input.lines().enumerate() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }
        match parse_json_int_array(trimmed) {
            Ok(path) => {
                let projection = project_trajectory(&path);
                // Ignore write errors on a closed pipe; nothing to recover.
                let _ = writeln!(out, "{}", compress_json(&path, &projection));
            }
            Err(message) => {
                had_error = true;
                eprintln!("error: line {}: {}", line_index + 1, message);
            }
        }
    }

    if had_error {
        Err(CliError::data(
            "one or more input lines were invalid".to_string(),
        ))
    } else {
        Ok(())
    }
}

/// Parse a single NDJSON line that must be a JSON array of Q3 integers, e.g.
/// `[0, 1, 3]`. Returns a validated trajectory (>= 2 states, each 0..=7).
fn parse_json_int_array(line: &str) -> Result<Vec<u8>, String> {
    let bytes = line.trim();
    let inner = bytes
        .strip_prefix('[')
        .and_then(|s| s.strip_suffix(']'))
        .ok_or_else(|| "expected a JSON array of integers, e.g. [0,1,3]".to_string())?;
    let mut path = Vec::new();
    for token in inner.split(',') {
        let token = token.trim();
        if token.is_empty() {
            continue;
        }
        let value: u32 = token
            .parse()
            .map_err(|_| format!("'{}' is not an integer", token))?;
        if value > Q3_MAX as u32 {
            return Err(format!("state {} out of range 0..=7", value));
        }
        path.push(value as u8);
    }
    if path.len() < 2 {
        return Err("a trajectory requires at least 2 states".to_string());
    }
    Ok(path)
}

// ---------------------------------------------------------------------------
// verify (self-test over all 4096 transitions)
// ---------------------------------------------------------------------------

fn cmd_verify(ctx: &Ctx) -> Result<(), CliError> {
    let total: u32 = 4096;
    let mut verified: u32 = 0;
    for index in 0..total {
        let source = (index / 64) as u8;
        let target = (index % 64) as u8;
        let naive = lookup_transition64(source, target)
            .map_err(|_| CliError::data("transition lookup failed".to_string()))?;
        let branchless = semagraph_core_rs::classify_branchless(source, target);
        let index_ok = transition_index64(source, target)
            .map(|i| i == naive.index)
            .unwrap_or(false);
        if branchless == naive && index_ok {
            verified += 1;
        }
    }

    let ok = verified == total;
    if !ctx.quiet {
        if ctx.json {
            let mut obj = JsonObject::new();
            obj.num("verified", verified as i64);
            obj.num("total", total as i64);
            obj.boolean("ok", ok);
            println!("{}", obj.finish());
        } else if ok {
            println!("OK: {}/{} transitions verified.", verified, total);
        } else {
            // Status text goes to stderr because this is a failure path.
            eprintln!("FAIL: {}/{} transitions verified.", verified, total);
        }
    }

    if ok {
        Ok(())
    } else {
        Err(CliError::data(format!(
            "self-test failed: {}/{} transitions verified",
            verified, total
        )))
    }
}

// ---------------------------------------------------------------------------
// formatting helpers
// ---------------------------------------------------------------------------

fn join_dot(values: &[u8]) -> String {
    values
        .iter()
        .map(|v| v.to_string())
        .collect::<Vec<_>>()
        .join(".")
}
fn join_dot_u32(values: &[u32]) -> String {
    values
        .iter()
        .map(|v| v.to_string())
        .collect::<Vec<_>>()
        .join(".")
}
fn join_space(values: &[u8]) -> String {
    values
        .iter()
        .map(|v| v.to_string())
        .collect::<Vec<_>>()
        .join(" ")
}
fn join_space_u32(values: &[u32]) -> String {
    values
        .iter()
        .map(|v| v.to_string())
        .collect::<Vec<_>>()
        .join(" ")
}
fn join_arrow(values: &[u8]) -> String {
    values
        .iter()
        .map(|v| v.to_string())
        .collect::<Vec<_>>()
        .join(" \u{2192} ")
}
fn json_array_u8(values: &[u8]) -> String {
    format!(
        "[{}]",
        values
            .iter()
            .map(|v| v.to_string())
            .collect::<Vec<_>>()
            .join(",")
    )
}
fn json_array_u32(values: &[u32]) -> String {
    format!(
        "[{}]",
        values
            .iter()
            .map(|v| v.to_string())
            .collect::<Vec<_>>()
            .join(",")
    )
}

/// Minimal JSON object builder producing compact single-line output. Keys are
/// emitted in insertion order, which is the documented field order.
#[derive(Default)]
struct JsonObject {
    parts: Vec<String>,
}
impl JsonObject {
    fn new() -> Self {
        Self { parts: Vec::new() }
    }
    fn num(&mut self, key: &str, value: i64) {
        self.parts.push(format!("{}:{}", json_string(key), value));
    }
    fn boolean(&mut self, key: &str, value: bool) {
        self.parts.push(format!("{}:{}", json_string(key), value));
    }
    fn str(&mut self, key: &str, value: &str) {
        self.parts
            .push(format!("{}:{}", json_string(key), json_string(value)));
    }
    fn raw(&mut self, key: &str, raw_value: &str) {
        self.parts
            .push(format!("{}:{}", json_string(key), raw_value));
    }
    fn finish(&self) -> String {
        format!("{{{}}}", self.parts.join(","))
    }
}

/// JSON-encode a string with the minimal required escaping.
fn json_string(value: &str) -> String {
    let mut out = String::with_capacity(value.len() + 2);
    out.push('"');
    for ch in value.chars() {
        match ch {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

fn help_text() -> String {
    let version = env!("CARGO_PKG_VERSION");
    format!(
        "semagraph {version} — deterministic state-transition trajectory classifier

USAGE:
    semagraph <SUBCOMMAND> [ARGS] [FLAGS]

SUBCOMMANDS:
    classify <source> <target>     Classify one Q6 transition (states 0..63).
    compress <s0> <s1> ... <sN>    Compress a Q3 trajectory (>=2 states, 0..7).
    compare  <a..> -- <b..>        Compare two Q3 trajectories via the cascade.
    lookup   <index>               Recover a transition by index (0..4095).
    batch                          Read NDJSON trajectories on stdin, write
                                   one NDJSON result per line to stdout.
    verify                         Self-test all 4096 transitions.

FLAGS:
    --json       Machine-readable JSON output (default: human-readable).
    --quiet      Suppress stdout data; errors and exit codes still apply.
    --version    Print version and exit.
    --help, -h   Print this help and exit.

Data is written to stdout, errors to stderr. Exit code 0 = success.
The tool performs no inference, no interpretation, and no network access.
See TOOL_DESCRIPTION.md for the full machine-readable contract.
"
    )
}
