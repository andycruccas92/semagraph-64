//! `semagraph-mcp` - a small Rust-backed MCP stdio server.
//!
//! The server intentionally avoids SDK/runtime dependencies. It implements the
//! small JSON-RPC/MCP subset needed by agents: initialize, tools/list, and
//! tools/call. All State64 transition and chain work is delegated to
//! `semagraph-core-rs`; no inference, storage, or network access is performed.

use std::collections::{BTreeMap, BTreeSet};
use std::io::{self, BufRead, Write};
use std::process::ExitCode;

use semagraph_core_rs::{compress_chain64, lookup_transition64, pack_transition64};

const VERSION: &str = env!("CARGO_PKG_VERSION");
const SERVER_NAME: &str = "semagraph-rs-mcp";
const INSTRUCTIONS: &str = "SemaGraph MCP exposes deterministic State64/Q6 anchoring and transition-chain compression. Do not infer observations or modify State64 ids, mutation masks, or deterministic signatures.";

const MODULE_SCOPE_NAMES: [&str; 4] = ["none", "lower_only", "upper_only", "both_modules"];
const REGIME_CLASS_NAMES: [&str; 6] = [
    "no_change",
    "bit_adjustment",
    "module_reconfiguration",
    "cross_module_regime_shift",
    "near_total_inversion",
    "full_bit_reversal",
];

fn main() -> ExitCode {
    if let Err(err) = serve() {
        let _ = writeln!(io::stderr(), "semagraph-mcp error: {err}");
        return ExitCode::from(1);
    }
    ExitCode::SUCCESS
}

fn serve() -> io::Result<()> {
    let stdin = io::stdin();
    let mut input = io::BufReader::new(stdin.lock());
    let stdout = io::stdout();
    let mut output = stdout.lock();

    while let Some(body) = read_frame(&mut input)? {
        let response = handle_message(&body);
        if let Some(payload) = response {
            write_frame(&mut output, &payload)?;
        }
    }

    Ok(())
}

fn read_frame<R: BufRead>(input: &mut R) -> io::Result<Option<String>> {
    let mut content_length: Option<usize> = None;
    loop {
        let mut line = String::new();
        let bytes = input.read_line(&mut line)?;
        if bytes == 0 {
            return Ok(None);
        }
        let trimmed = line.trim_end_matches(['\r', '\n']);
        if trimmed.is_empty() {
            break;
        }
        if let Some((name, value)) = trimmed.split_once(':') {
            if name.eq_ignore_ascii_case("content-length") {
                let parsed = value.trim().parse::<usize>().map_err(|_| {
                    io::Error::new(io::ErrorKind::InvalidData, "invalid Content-Length")
                })?;
                content_length = Some(parsed);
            }
        }
    }

    let len = content_length
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "missing Content-Length"))?;
    let mut body = vec![0u8; len];
    input.read_exact(&mut body)?;
    String::from_utf8(body)
        .map(Some)
        .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "frame body is not UTF-8"))
}

fn write_frame<W: Write>(output: &mut W, payload: &str) -> io::Result<()> {
    write!(
        output,
        "Content-Length: {}\r\n\r\n{}",
        payload.len(),
        payload
    )?;
    output.flush()
}

fn handle_message(body: &str) -> Option<String> {
    let parsed = match JsonParser::new(body).parse() {
        Ok(value) => value,
        Err(err) => return Some(error_response(Json::Null, -32700, &err)),
    };

    let Json::Object(message) = parsed else {
        return Some(error_response(
            Json::Null,
            -32600,
            "request must be a JSON object",
        ));
    };

    let id = message.get("id").cloned();
    let method = match message.get("method").and_then(Json::as_str) {
        Some(method) => method,
        None => return id.map(|id| error_response(id, -32600, "missing method")),
    };

    match method {
        "initialize" => id.map(initialize_response),
        "notifications/initialized" => None,
        "tools/list" => id.map(tools_list_response),
        "tools/call" => id.map(|id| tools_call_response(id, message.get("params"))),
        _ => id.map(|id| error_response(id, -32601, "unknown method")),
    }
}

fn initialize_response(id: Json) -> String {
    let result = obj(vec![
        ("protocolVersion", string("2024-11-05")),
        ("capabilities", obj(vec![("tools", obj(vec![]))])),
        (
            "serverInfo",
            obj(vec![
                ("name", string(SERVER_NAME)),
                ("version", string(VERSION)),
            ]),
        ),
        ("instructions", string(INSTRUCTIONS)),
    ]);
    success_response(id, result)
}

fn tools_list_response(id: Json) -> String {
    success_response(id, obj(vec![("tools", Json::Array(tool_definitions()))]))
}

fn tools_call_response(id: Json, params: Option<&Json>) -> String {
    let Some(Json::Object(params)) = params else {
        return error_response(id, -32602, "tools/call requires params");
    };
    let Some(name) = params.get("name").and_then(Json::as_str) else {
        return error_response(id, -32602, "tools/call requires params.name");
    };
    let args = params
        .get("arguments")
        .cloned()
        .unwrap_or_else(|| obj(vec![]));

    let tool_result = dispatch_tool(name, &args);
    let is_error = matches!(
        tool_result.get("status").and_then(Json::as_str),
        Some("rejected")
    );
    let text = tool_result.to_pretty_string(0);
    let mut fields = vec![
        (
            "content",
            Json::Array(vec![obj(vec![
                ("type", string("text")),
                ("text", string(&text)),
            ])]),
        ),
        ("structuredContent", tool_result),
    ];
    if is_error {
        fields.push(("isError", Json::Bool(true)));
    }
    success_response(id, obj(fields))
}

fn success_response(id: Json, result: Json) -> String {
    obj(vec![
        ("jsonrpc", string("2.0")),
        ("id", id),
        ("result", result),
    ])
    .to_compact_string()
}

fn error_response(id: Json, code: i64, message: &str) -> String {
    obj(vec![
        ("jsonrpc", string("2.0")),
        ("id", id),
        (
            "error",
            obj(vec![
                ("code", Json::Number(code)),
                ("message", string(message)),
            ]),
        ),
    ])
    .to_compact_string()
}

fn dispatch_tool(name: &str, args: &Json) -> Json {
    let outcome = match name {
        "semagraph_anchor_state64" => tool_anchor_state64(args),
        "semagraph_lookup_transition64" => tool_lookup_transition64(args),
        "semagraph_compress_chain64" => tool_compress_chain64(args),
        "semagraph_policy_context64" => tool_policy_context64(args),
        "semagraph_analyze_scenarios64" => tool_analyze_scenarios64(args),
        "semagraph_validate_policy_packet64" => tool_validate_policy_packet64(args),
        "semagraph_verify_transition_basis" => tool_verify_transition_basis(),
        _ => Err(format!("Unknown SemaGraph tool: {name}")),
    };

    match outcome {
        Ok(result) => obj(vec![
            ("tool", string(name)),
            ("status", string("ok")),
            ("result", result),
        ]),
        Err(error) => obj(vec![
            ("tool", string(name)),
            ("status", string("rejected")),
            ("error", string(&error)),
        ]),
    }
}

fn tool_anchor_state64(args: &Json) -> Result<Json, String> {
    let observations = get_array(args, "observations")?;
    if observations.len() != 6 {
        return Err("State64 anchoring requires exactly six observations/rules.".to_string());
    }

    let mut binary = String::with_capacity(6);
    let mut decisions = Vec::with_capacity(6);

    for (index, observation) in observations.iter().enumerate() {
        let key = get_string(observation, "key")?;
        if key.trim().is_empty() {
            return Err(format!("Observation at index {index} has an empty key."));
        }
        let value = get_field(observation, "value")?;
        let threshold = get_field(observation, "threshold")?;
        let operator = get_string(observation, "operator")?;
        let result = compare_values(value, operator, threshold)?;
        let true_bit = optional_bit(observation, "trueBit")?.unwrap_or(1);
        let false_bit = optional_bit(observation, "falseBit")?.unwrap_or(0);
        let bit = if result { true_bit } else { false_bit };
        binary.push(if bit == 1 { '1' } else { '0' });

        let mut decision_fields = vec![
            ("position", Json::Number((index + 1) as i64)),
            ("key", string(key)),
            ("operator", string(operator)),
            ("value", value.clone()),
            ("threshold", threshold.clone()),
            ("result", Json::Bool(result)),
            ("trueBit", Json::Number(true_bit as i64)),
            ("falseBit", Json::Number(false_bit as i64)),
            ("bit", Json::Number(bit as i64)),
        ];
        if let Some(source) = optional_string(observation, "source")? {
            decision_fields.push(("source", string(source)));
        }
        if let Some(unit) = optional_string(observation, "unit")? {
            decision_fields.push(("unit", string(unit)));
        }
        decisions.push(obj(decision_fields));
    }

    let state_id = format!("S64-{binary}");
    Ok(obj(vec![
        ("stateId", string(&state_id)),
        ("stateNumber", Json::Number(parse_six_bit(&binary)? as i64)),
        ("binary", string(&binary)),
        ("decisions", Json::Array(decisions)),
        ("anchorMode", string("deterministic_observed_parameters")),
        ("inferenceUsed", Json::Bool(false)),
    ]))
}

fn tool_lookup_transition64(args: &Json) -> Result<Json, String> {
    let source_id = get_string(args, "sourceStateId")?;
    let target_id = get_string(args, "targetStateId")?;
    let source = state_id_to_number(source_id)?;
    let target = state_id_to_number(target_id)?;
    let entry =
        lookup_transition64(source, target).map_err(|_| "transition lookup failed".to_string())?;
    Ok(transition_json(&entry))
}

fn tool_compress_chain64(args: &Json) -> Result<Json, String> {
    let state_values = get_array(args, "states")?;
    if state_values.len() < 2 {
        return Err("A State64 chain requires at least two states.".to_string());
    }

    let mut states = Vec::with_capacity(state_values.len());
    let mut state_ids = Vec::with_capacity(state_values.len());
    for value in state_values {
        let Some(id) = value.as_str() else {
            return Err("states must contain State64 id strings.".to_string());
        };
        states.push(state_id_to_number(id)?);
        state_ids.push(id.to_string());
    }

    let compression =
        compress_chain64(&states).map_err(|_| "chain compression failed".to_string())?;
    let mut transitions = Vec::with_capacity(states.len() - 1);
    let mut masks = Vec::with_capacity(states.len() - 1);
    for pair in states.windows(2) {
        let entry = lookup_transition64(pair[0], pair[1])
            .map_err(|_| "transition lookup failed".to_string())?;
        masks.push(mask_id(entry.mutation_mask));
        transitions.push(transition_json(&entry));
    }

    let source_id = state_ids[0].clone();
    let target_id = state_ids[state_ids.len() - 1].clone();
    let net_mask = mask_id(compression.net_mutation_mask);
    let signature = format!(
        "C64:{}>{}|M:{}|N:{}",
        source_id,
        target_id,
        masks.join("."),
        net_mask
    );

    Ok(obj(vec![
        ("sourceStateId", string(&source_id)),
        ("targetStateId", string(&target_id)),
        (
            "states",
            Json::Array(state_ids.iter().map(|id| string(id)).collect()),
        ),
        ("transitions", Json::Array(transitions)),
        (
            "orderedMutationMasks",
            Json::Array(masks.iter().map(|mask| string(mask)).collect()),
        ),
        ("netMutationMask", string(&net_mask)),
        (
            "cumulativeDistance",
            Json::Number(compression.cumulative_distance as i64),
        ),
        ("signature", string(&signature)),
        (
            "stateNumbers",
            Json::Array(
                states
                    .iter()
                    .map(|value| Json::Number(*value as i64))
                    .collect(),
            ),
        ),
        (
            "netMutationMaskNumber",
            Json::Number(compression.net_mutation_mask as i64),
        ),
        ("inferenceUsed", Json::Bool(false)),
    ]))
}

fn tool_policy_context64(args: &Json) -> Result<Json, String> {
    let compression = tool_compress_chain64(args)?;
    let objective = optional_string(args, "objective")?
        .unwrap_or("stabilize operational response to the observed transition signature");
    let constraints = optional_string_array(args, "constraints")?.unwrap_or_default();
    let evidence_refs = optional_string_array(args, "evidenceRefs")?.unwrap_or_default();
    let signature = compression
        .get("signature")
        .and_then(Json::as_str)
        .ok_or_else(|| "compression signature missing".to_string())?
        .to_string();

    Ok(obj(vec![
        (
            "policySynthesisBoundary",
            string("LLM may synthesize policy only after deterministic state anchoring and transition compression. LLM must not modify states, measurements, masks or signatures."),
        ),
        ("objective", string(objective)),
        (
            "constraints",
            Json::Array(constraints.iter().map(|value| string(value)).collect()),
        ),
        (
            "evidenceRefs",
            Json::Array(evidence_refs.iter().map(|value| string(value)).collect()),
        ),
        ("compressedTransition", compression),
        (
            "requiredPolicyOutput",
            obj(vec![
                ("policyId", string("string")),
                ("policySummary", string("string")),
                ("triggerSignature", string(&signature)),
                ("allowedActions", Json::Array(vec![string("string")])),
                (
                    "forbiddenActions",
                    Json::Array(vec![
                        string("do not infer or mutate observed states"),
                        string("do not override deterministic transition signature"),
                    ]),
                ),
                ("reviewRequired", Json::Bool(true)),
            ]),
        ),
    ]))
}

#[derive(Clone)]
struct ScenarioInput {
    id: String,
    states: Vec<String>,
    objective: Option<String>,
}

#[derive(Clone)]
struct ScenarioReport {
    id: String,
    source_state_id: String,
    target_state_id: String,
    states: Vec<String>,
    transition_count: usize,
    ordered_mutation_masks: Vec<String>,
    net_mutation_mask: String,
    cumulative_distance: u32,
    net_distance: u32,
    dominant_regime_class: String,
    volatility_class: String,
    policy_readiness: String,
    signature: String,
    summary: String,
    objective: Option<String>,
}

struct ComparePair {
    left: String,
    right: String,
}

struct WorkbenchArgs {
    scenarios: Vec<ScenarioInput>,
    compare_pairs: Vec<ComparePair>,
    excluded_policy_ids: BTreeSet<String>,
}

fn tool_analyze_scenarios64(args: &Json) -> Result<Json, String> {
    let workbench_args = parse_workbench_args(args)?;
    build_policy_workbench_packet(
        &workbench_args.scenarios,
        &workbench_args.compare_pairs,
        &workbench_args.excluded_policy_ids,
    )
}

fn tool_validate_policy_packet64(args: &Json) -> Result<Json, String> {
    let packet = get_field(args, "packet")?;
    let workbench_args = parse_workbench_args(args)?;
    let expected = build_policy_workbench_packet(
        &workbench_args.scenarios,
        &workbench_args.compare_pairs,
        &workbench_args.excluded_policy_ids,
    )?;
    let mut errors = Vec::new();

    for key in ["scenarios", "aggregate", "comparisons", "policyQueue"] {
        let actual_value = packet.get(key).unwrap_or(&Json::Null);
        let expected_value = expected.get(key).unwrap_or(&Json::Null);
        if !json_semantic_equal(actual_value, expected_value) {
            errors.push(obj(vec![
                ("path", string(&format!("/{key}"))),
                ("expected", expected_value.clone()),
                ("actual", actual_value.clone()),
            ]));
        }
    }

    Ok(obj(vec![
        ("valid", Json::Bool(errors.is_empty())),
        ("errors", Json::Array(errors)),
        ("expected", expected),
        ("inferenceUsed", Json::Bool(false)),
    ]))
}

fn parse_workbench_args(args: &Json) -> Result<WorkbenchArgs, String> {
    let scenario_values = get_array(args, "scenarios")?;
    if scenario_values.is_empty() {
        return Err("scenarios must contain at least one scenario".to_string());
    }

    let mut scenarios = Vec::with_capacity(scenario_values.len());
    for scenario in scenario_values {
        let id = get_string(scenario, "id")?.to_string();
        let state_values = get_array(scenario, "states")?;
        if state_values.len() < 2 {
            return Err(format!("scenario {id} requires at least two states"));
        }
        let mut states = Vec::with_capacity(state_values.len());
        for state_value in state_values {
            let Some(state_id) = state_value.as_str() else {
                return Err(format!(
                    "scenario {id} states must contain State64 id strings"
                ));
            };
            state_id_to_number(state_id)?;
            states.push(state_id.to_string());
        }
        let objective = optional_string(scenario, "objective")?.map(str::to_string);
        scenarios.push(ScenarioInput {
            id,
            states,
            objective,
        });
    }

    let mut compare_pairs = Vec::new();
    if let Some(pair_values) = optional_array(args, "comparePairs")? {
        for pair in pair_values {
            compare_pairs.push(ComparePair {
                left: get_string(pair, "left")?.to_string(),
                right: get_string(pair, "right")?.to_string(),
            });
        }
    }

    let excluded_policy_ids = optional_string_array(args, "excludePolicyScenarioIds")?
        .unwrap_or_default()
        .into_iter()
        .collect();

    Ok(WorkbenchArgs {
        scenarios,
        compare_pairs,
        excluded_policy_ids,
    })
}

fn build_policy_workbench_packet(
    scenario_inputs: &[ScenarioInput],
    compare_pairs: &[ComparePair],
    excluded_policy_ids: &BTreeSet<String>,
) -> Result<Json, String> {
    let mut reports = Vec::with_capacity(scenario_inputs.len());
    for scenario in scenario_inputs {
        reports.push(analyze_scenario(scenario)?);
    }

    let mut by_id = BTreeMap::new();
    for report in &reports {
        by_id.insert(report.id.clone(), report.clone());
    }

    Ok(obj(vec![
        (
            "scenarios",
            Json::Array(reports.iter().map(scenario_report_json).collect()),
        ),
        ("aggregate", aggregate_json(&reports)),
        (
            "comparisons",
            Json::Array(
                compare_pairs
                    .iter()
                    .map(|pair| comparison_json(pair, &by_id))
                    .collect::<Result<Vec<_>, _>>()?,
            ),
        ),
        (
            "policyQueue",
            Json::Array(
                reports
                    .iter()
                    .filter(|report| !excluded_policy_ids.contains(&report.id))
                    .map(policy_queue_item_json)
                    .collect(),
            ),
        ),
        ("inferenceUsed", Json::Bool(false)),
    ]))
}

fn analyze_scenario(scenario: &ScenarioInput) -> Result<ScenarioReport, String> {
    let state_numbers = scenario
        .states
        .iter()
        .map(|state| state_id_to_number(state))
        .collect::<Result<Vec<_>, _>>()?;
    let compression =
        compress_chain64(&state_numbers).map_err(|_| "chain compression failed".to_string())?;

    let mut ordered_mutation_masks = Vec::with_capacity(state_numbers.len() - 1);
    let mut cumulative_distance = 0u32;
    let mut regime_stats: BTreeMap<String, (u32, u32)> = BTreeMap::new();
    for pair in state_numbers.windows(2) {
        let entry = lookup_transition64(pair[0], pair[1])
            .map_err(|_| "transition lookup failed".to_string())?;
        let regime_class = REGIME_CLASS_NAMES[entry.regime_class as usize].to_string();
        ordered_mutation_masks.push(mask_id(entry.mutation_mask));
        cumulative_distance += entry.distance as u32;
        let stat = regime_stats.entry(regime_class).or_insert((0, 0));
        stat.0 += 1;
        stat.1 += entry.distance as u32;
    }

    let dominant_regime_class = dominant_regime_class(&regime_stats)?;
    let source_state_id = scenario.states[0].clone();
    let target_state_id = scenario.states[scenario.states.len() - 1].clone();
    let net_mutation_mask = mask_id(compression.net_mutation_mask);
    let net_distance = compression.net_mutation_mask.count_ones();
    let volatility_class = volatility_class(cumulative_distance).to_string();
    let policy_readiness = policy_readiness(&volatility_class).to_string();
    let signature = format!(
        "C64:{}>{}|M:{}|N:{}",
        source_state_id,
        target_state_id,
        ordered_mutation_masks.join("."),
        net_mutation_mask
    );
    let summary = format!(
        "{}: {} to {}; {}; cumulative distance {}.",
        scenario.id, source_state_id, target_state_id, volatility_class, cumulative_distance
    );

    Ok(ScenarioReport {
        id: scenario.id.clone(),
        source_state_id,
        target_state_id,
        states: scenario.states.clone(),
        transition_count: ordered_mutation_masks.len(),
        ordered_mutation_masks,
        net_mutation_mask,
        cumulative_distance,
        net_distance,
        dominant_regime_class,
        volatility_class,
        policy_readiness,
        signature,
        summary,
        objective: scenario.objective.clone(),
    })
}

fn scenario_report_json(report: &ScenarioReport) -> Json {
    obj(vec![
        ("id", string(&report.id)),
        ("sourceStateId", string(&report.source_state_id)),
        ("targetStateId", string(&report.target_state_id)),
        (
            "states",
            Json::Array(report.states.iter().map(|state| string(state)).collect()),
        ),
        (
            "transitionCount",
            Json::Number(report.transition_count as i64),
        ),
        (
            "orderedMutationMasks",
            Json::Array(
                report
                    .ordered_mutation_masks
                    .iter()
                    .map(|mask| string(mask))
                    .collect(),
            ),
        ),
        ("netMutationMask", string(&report.net_mutation_mask)),
        (
            "cumulativeDistance",
            Json::Number(report.cumulative_distance as i64),
        ),
        ("netDistance", Json::Number(report.net_distance as i64)),
        ("dominantRegimeClass", string(&report.dominant_regime_class)),
        ("volatilityClass", string(&report.volatility_class)),
        ("policyReadiness", string(&report.policy_readiness)),
        ("signature", string(&report.signature)),
        ("summary", string(&report.summary)),
    ])
}

fn aggregate_json(reports: &[ScenarioReport]) -> Json {
    let total_transitions: usize = reports.iter().map(|report| report.transition_count).sum();
    let total_cumulative_distance: u32 = reports
        .iter()
        .map(|report| report.cumulative_distance)
        .sum();
    let average_cumulative_distance =
        round3(total_cumulative_distance as f64 / reports.len() as f64);
    let max_cumulative_distance = reports
        .iter()
        .map(|report| report.cumulative_distance)
        .max()
        .unwrap_or(0);

    obj(vec![
        ("scenarioCount", Json::Number(reports.len() as i64)),
        ("totalTransitions", Json::Number(total_transitions as i64)),
        (
            "totalCumulativeDistance",
            Json::Number(total_cumulative_distance as i64),
        ),
        (
            "averageCumulativeDistance",
            Json::Float(average_cumulative_distance),
        ),
        (
            "maxCumulativeDistanceScenarioIds",
            Json::Array(
                reports
                    .iter()
                    .filter(|report| report.cumulative_distance == max_cumulative_distance)
                    .map(|report| string(&report.id))
                    .collect(),
            ),
        ),
        (
            "volatilityHistogram",
            histogram_json(
                reports
                    .iter()
                    .map(|report| report.volatility_class.as_str()),
            ),
        ),
        (
            "dominantRegimeHistogram",
            histogram_json(
                reports
                    .iter()
                    .map(|report| report.dominant_regime_class.as_str()),
            ),
        ),
        (
            "netMutationHistogram",
            histogram_json(
                reports
                    .iter()
                    .map(|report| report.net_mutation_mask.as_str()),
            ),
        ),
    ])
}

fn comparison_json(
    pair: &ComparePair,
    by_id: &BTreeMap<String, ScenarioReport>,
) -> Result<Json, String> {
    let left = by_id
        .get(&pair.left)
        .ok_or_else(|| format!("unknown comparison left scenario: {}", pair.left))?;
    let right = by_id
        .get(&pair.right)
        .ok_or_else(|| format!("unknown comparison right scenario: {}", pair.right))?;
    let left_masks = left
        .ordered_mutation_masks
        .iter()
        .cloned()
        .collect::<BTreeSet<_>>();
    let left_states = left.states.iter().cloned().collect::<BTreeSet<_>>();
    let shared_ordered_mutation_mask_count = right
        .ordered_mutation_masks
        .iter()
        .filter(|mask| left_masks.contains(*mask))
        .count();
    let shared_state_count = right
        .states
        .iter()
        .filter(|state| left_states.contains(*state))
        .count();
    let cumulative_distance_delta =
        left.cumulative_distance.abs_diff(right.cumulative_distance) as i64;

    Ok(obj(vec![
        ("left", string(&pair.left)),
        ("right", string(&pair.right)),
        (
            "sameNetMutationMask",
            Json::Bool(left.net_mutation_mask == right.net_mutation_mask),
        ),
        (
            "sameDominantRegimeClass",
            Json::Bool(left.dominant_regime_class == right.dominant_regime_class),
        ),
        (
            "sameVolatilityClass",
            Json::Bool(left.volatility_class == right.volatility_class),
        ),
        (
            "cumulativeDistanceDelta",
            Json::Number(cumulative_distance_delta),
        ),
        (
            "sharedOrderedMutationMaskCount",
            Json::Number(shared_ordered_mutation_mask_count as i64),
        ),
        ("sharedStateCount", Json::Number(shared_state_count as i64)),
    ]))
}

fn policy_queue_item_json(report: &ScenarioReport) -> Json {
    obj(vec![
        ("scenarioId", string(&report.id)),
        ("triggerSignature", string(&report.signature)),
        (
            "objective",
            string(report.objective.as_deref().unwrap_or("")),
        ),
        (
            "priority",
            string(policy_priority(&report.volatility_class)),
        ),
        (
            "allowedActions",
            Json::Array(vec![
                string("monitor"),
                string("review"),
                string("escalate"),
            ]),
        ),
        (
            "forbiddenActions",
            Json::Array(vec![
                string("do not infer observations"),
                string("do not mutate State64 ids"),
                string("do not override deterministic signatures"),
            ]),
        ),
        ("reviewRequired", Json::Bool(true)),
    ])
}

fn dominant_regime_class(regime_stats: &BTreeMap<String, (u32, u32)>) -> Result<String, String> {
    let mut ranked = regime_stats.iter().collect::<Vec<_>>();
    ranked.sort_by(
        |(left_name, (left_count, left_distance)), (right_name, (right_count, right_distance))| {
            right_count
                .cmp(left_count)
                .then(right_distance.cmp(left_distance))
                .then(left_name.cmp(right_name))
        },
    );
    ranked
        .first()
        .map(|(name, _)| (*name).clone())
        .ok_or_else(|| "scenario requires at least one transition".to_string())
}

fn volatility_class(cumulative_distance: u32) -> &'static str {
    if cumulative_distance <= 3 {
        "calm"
    } else if cumulative_distance <= 7 {
        "active"
    } else {
        "volatile"
    }
}

fn policy_readiness(volatility_class: &str) -> &'static str {
    match volatility_class {
        "calm" => "hold",
        "active" => "review",
        _ => "escalate",
    }
}

fn policy_priority(volatility_class: &str) -> &'static str {
    match volatility_class {
        "calm" => "low",
        "active" => "normal",
        _ => "high",
    }
}

fn round3(value: f64) -> f64 {
    (value * 1000.0).round() / 1000.0
}

fn histogram_json<'a>(values: impl Iterator<Item = &'a str>) -> Json {
    let mut histogram = BTreeMap::new();
    for value in values {
        let entry = histogram.entry(value.to_string()).or_insert(0i64);
        *entry += 1;
    }
    Json::Object(
        histogram
            .into_iter()
            .map(|(key, count)| (key, Json::Number(count)))
            .collect(),
    )
}

fn json_semantic_equal(left: &Json, right: &Json) -> bool {
    match (left, right) {
        (Json::Number(left), Json::Float(right)) => (*left as f64 - *right).abs() < f64::EPSILON,
        (Json::Float(left), Json::Number(right)) => (*left - *right as f64).abs() < f64::EPSILON,
        (Json::Array(left), Json::Array(right)) => {
            left.len() == right.len()
                && left
                    .iter()
                    .zip(right.iter())
                    .all(|(left, right)| json_semantic_equal(left, right))
        }
        (Json::Object(left), Json::Object(right)) => {
            left.len() == right.len()
                && left.iter().all(|(key, left_value)| {
                    right
                        .get(key)
                        .is_some_and(|right_value| json_semantic_equal(left_value, right_value))
                })
        }
        _ => left == right,
    }
}

fn tool_verify_transition_basis() -> Result<Json, String> {
    let total = 4096i64;
    let mut verified = 0i64;
    for source in 0u8..64 {
        for target in 0u8..64 {
            let entry = lookup_transition64(source, target)
                .map_err(|_| "transition lookup failed".to_string())?;
            if entry.index == (source as u16) * 64 + target as u16 {
                verified += 1;
            }
        }
    }
    Ok(obj(vec![
        ("verified", Json::Number(verified)),
        ("total", Json::Number(total)),
        ("ok", Json::Bool(verified == total)),
        ("inferenceUsed", Json::Bool(false)),
    ]))
}

fn transition_json(entry: &semagraph_core_rs::Transition64Entry) -> Json {
    let source_id = state_number_to_id(entry.source);
    let target_id = state_number_to_id(entry.target);
    let mutation_mask = mask_id(entry.mutation_mask);
    obj(vec![
        ("sourceStateId", string(&source_id)),
        ("targetStateId", string(&target_id)),
        ("mutationMask", string(&mutation_mask)),
        (
            "changedPositions",
            Json::Array(
                changed_positions(entry.mutation_mask)
                    .iter()
                    .map(|position| Json::Number(*position as i64))
                    .collect(),
            ),
        ),
        ("distance", Json::Number(entry.distance as i64)),
        ("lowerDistance", Json::Number(entry.lower_distance as i64)),
        ("upperDistance", Json::Number(entry.upper_distance as i64)),
        (
            "moduleScope",
            string(MODULE_SCOPE_NAMES[entry.module_scope as usize]),
        ),
        (
            "regimeClass",
            string(REGIME_CLASS_NAMES[entry.regime_class as usize]),
        ),
        ("sourceNumber", Json::Number(entry.source as i64)),
        ("targetNumber", Json::Number(entry.target as i64)),
        (
            "mutationMaskNumber",
            Json::Number(entry.mutation_mask as i64),
        ),
        ("transitionIndex", Json::Number(entry.index as i64)),
        ("packed", string(&pack_transition64(*entry).to_string())),
        ("inferenceUsed", Json::Bool(false)),
    ])
}

fn compare_values(left: &Json, operator: &str, right: &Json) -> Result<bool, String> {
    match operator {
        "eq" => Ok(left == right),
        "neq" => Ok(left != right),
        "gt" | "gte" | "lt" | "lte" => {
            let (Some(a), Some(b)) = (left.as_f64(), right.as_f64()) else {
                return Err(format!(
                    "Operator {operator} requires numeric value and threshold."
                ));
            };
            Ok(match operator {
                "gt" => a > b,
                "gte" => a >= b,
                "lt" => a < b,
                "lte" => a <= b,
                _ => unreachable!(),
            })
        }
        _ => Err(format!("Unsupported operator: {operator}")),
    }
}

fn state_id_to_number(id: &str) -> Result<u8, String> {
    let Some(binary) = id.strip_prefix("S64-") else {
        return Err(format!(
            "Expected State64 id like S64-010101, received: {id}"
        ));
    };
    if binary.len() != 6 || !binary.chars().all(|c| c == '0' || c == '1') {
        return Err(format!(
            "Expected State64 id like S64-010101, received: {id}"
        ));
    }
    parse_six_bit(binary)
}

fn parse_six_bit(binary: &str) -> Result<u8, String> {
    u8::from_str_radix(binary, 2).map_err(|_| format!("Invalid six-bit binary code: {binary}"))
}

fn state_number_to_id(value: u8) -> String {
    format!("S64-{value:06b}")
}

fn mask_id(value: u8) -> String {
    format!("M64-{value:06b}")
}

fn changed_positions(mask: u8) -> Vec<u8> {
    format!("{mask:06b}")
        .chars()
        .enumerate()
        .filter_map(|(index, bit)| {
            if bit == '1' {
                Some(index as u8 + 1)
            } else {
                None
            }
        })
        .collect()
}

fn get_field<'a>(json: &'a Json, key: &str) -> Result<&'a Json, String> {
    let Json::Object(fields) = json else {
        return Err("expected object arguments".to_string());
    };
    fields
        .get(key)
        .ok_or_else(|| format!("missing required field {key}"))
}

fn get_string<'a>(json: &'a Json, key: &str) -> Result<&'a str, String> {
    get_field(json, key)?
        .as_str()
        .ok_or_else(|| format!("field {key} must be a string"))
}

fn get_array<'a>(json: &'a Json, key: &str) -> Result<&'a [Json], String> {
    get_field(json, key)?
        .as_array()
        .ok_or_else(|| format!("field {key} must be an array"))
}

fn optional_array<'a>(json: &'a Json, key: &str) -> Result<Option<&'a [Json]>, String> {
    let Json::Object(fields) = json else {
        return Err("expected object arguments".to_string());
    };
    match fields.get(key) {
        Some(value) => value
            .as_array()
            .map(Some)
            .ok_or_else(|| format!("field {key} must be an array")),
        None => Ok(None),
    }
}

fn optional_string<'a>(json: &'a Json, key: &str) -> Result<Option<&'a str>, String> {
    let Json::Object(fields) = json else {
        return Err("expected object arguments".to_string());
    };
    match fields.get(key) {
        Some(value) => value
            .as_str()
            .map(Some)
            .ok_or_else(|| format!("field {key} must be a string")),
        None => Ok(None),
    }
}

fn optional_string_array(json: &Json, key: &str) -> Result<Option<Vec<String>>, String> {
    let Json::Object(fields) = json else {
        return Err("expected object arguments".to_string());
    };
    let Some(value) = fields.get(key) else {
        return Ok(None);
    };
    let Some(items) = value.as_array() else {
        return Err(format!("field {key} must be an array"));
    };
    let mut strings = Vec::with_capacity(items.len());
    for item in items {
        let Some(text) = item.as_str() else {
            return Err(format!("field {key} must contain only strings"));
        };
        strings.push(text.to_string());
    }
    Ok(Some(strings))
}

fn optional_bit(json: &Json, key: &str) -> Result<Option<u8>, String> {
    let Json::Object(fields) = json else {
        return Err("expected object arguments".to_string());
    };
    let Some(value) = fields.get(key) else {
        return Ok(None);
    };
    let Some(number) = value.as_i64() else {
        return Err(format!("field {key} must be 0 or 1"));
    };
    if number == 0 || number == 1 {
        Ok(Some(number as u8))
    } else {
        Err(format!("field {key} must be 0 or 1"))
    }
}

fn tool_definitions() -> Vec<Json> {
    vec![
        tool_definition(
            "semagraph_anchor_state64",
            "Deterministically anchor exactly six observed or known parameters into a State64 six-bit state. This tool must not infer missing observations.",
            anchor_schema(),
        ),
        tool_definition(
            "semagraph_lookup_transition64",
            "Look up deterministic State64 transition metadata for a source and target state.",
            state_pair_schema(),
        ),
        tool_definition(
            "semagraph_compress_chain64",
            "Compress an ordered chain of State64 states into mutation masks, net mutation and deterministic transition signature.",
            chain_schema(),
        ),
        tool_definition(
            "semagraph_policy_context64",
            "Build a policy-synthesis context from a deterministic State64 transition chain. The LLM may write policy but must not alter observed states or signatures.",
            policy_schema(),
        ),
        tool_definition(
            "semagraph_analyze_scenarios64",
            "Build a deterministic policy-transition workbench packet for multiple State64 scenarios, including scenario reports, aggregate metrics, pair comparisons and policy queue fields. Use this instead of hand-computing masks, distances, comparisons or signatures in an agent.",
            scenario_workbench_schema(),
        ),
        tool_definition(
            "semagraph_validate_policy_packet64",
            "Validate an agent-produced policy-transition workbench packet against deterministic State64 scenario inputs. Returns exact mismatches before handoff.",
            validate_policy_packet_schema(),
        ),
        tool_definition(
            "semagraph_verify_transition_basis",
            "Verify that the Rust-backed 64 x 64 direct transition basis is complete and deterministic.",
            obj(vec![
                ("type", string("object")),
                ("additionalProperties", Json::Bool(false)),
                ("properties", obj(vec![])),
            ]),
        ),
    ]
}

fn tool_definition(name: &str, description: &str, input_schema: Json) -> Json {
    obj(vec![
        ("name", string(name)),
        ("description", string(description)),
        ("inputSchema", input_schema),
    ])
}

fn anchor_schema() -> Json {
    obj(vec![
        ("type", string("object")),
        ("additionalProperties", Json::Bool(false)),
        ("required", Json::Array(vec![string("observations")])),
        (
            "properties",
            obj(vec![(
                "observations",
                obj(vec![
                    ("type", string("array")),
                    ("minItems", Json::Number(6)),
                    ("maxItems", Json::Number(6)),
                    (
                        "items",
                        obj(vec![
                            ("type", string("object")),
                            ("additionalProperties", Json::Bool(false)),
                            (
                                "required",
                                Json::Array(vec![
                                    string("key"),
                                    string("value"),
                                    string("operator"),
                                    string("threshold"),
                                ]),
                            ),
                            (
                                "properties",
                                obj(vec![
                                    ("key", obj(vec![("type", string("string"))])),
                                    ("value", scalar_schema()),
                                    (
                                        "operator",
                                        obj(vec![
                                            ("type", string("string")),
                                            (
                                                "enum",
                                                Json::Array(
                                                    ["eq", "neq", "gt", "gte", "lt", "lte"]
                                                        .iter()
                                                        .map(|value| string(value))
                                                        .collect(),
                                                ),
                                            ),
                                        ]),
                                    ),
                                    ("threshold", scalar_schema()),
                                    ("trueBit", bit_schema()),
                                    ("falseBit", bit_schema()),
                                    ("unit", obj(vec![("type", string("string"))])),
                                    ("source", obj(vec![("type", string("string"))])),
                                ]),
                            ),
                        ]),
                    ),
                ]),
            )]),
        ),
    ])
}

fn scalar_schema() -> Json {
    obj(vec![(
        "oneOf",
        Json::Array(vec![
            obj(vec![("type", string("number"))]),
            obj(vec![("type", string("boolean"))]),
            obj(vec![("type", string("string"))]),
        ]),
    )])
}

fn bit_schema() -> Json {
    obj(vec![
        ("type", string("integer")),
        ("enum", Json::Array(vec![Json::Number(0), Json::Number(1)])),
    ])
}

fn state_pair_schema() -> Json {
    obj(vec![
        ("type", string("object")),
        ("additionalProperties", Json::Bool(false)),
        (
            "required",
            Json::Array(vec![string("sourceStateId"), string("targetStateId")]),
        ),
        (
            "properties",
            obj(vec![
                ("sourceStateId", state_id_schema()),
                ("targetStateId", state_id_schema()),
            ]),
        ),
    ])
}

fn chain_schema() -> Json {
    obj(vec![
        ("type", string("object")),
        ("additionalProperties", Json::Bool(false)),
        ("required", Json::Array(vec![string("states")])),
        (
            "properties",
            obj(vec![(
                "states",
                obj(vec![
                    ("type", string("array")),
                    ("minItems", Json::Number(2)),
                    ("items", state_id_schema()),
                ]),
            )]),
        ),
    ])
}

fn policy_schema() -> Json {
    let mut schema = chain_schema();
    let Some(properties) = schema.get_mut("properties") else {
        return schema;
    };
    if let Json::Object(fields) = properties {
        fields.insert(
            "objective".to_string(),
            obj(vec![("type", string("string"))]),
        );
        fields.insert(
            "constraints".to_string(),
            obj(vec![
                ("type", string("array")),
                ("items", obj(vec![("type", string("string"))])),
            ]),
        );
        fields.insert(
            "evidenceRefs".to_string(),
            obj(vec![
                ("type", string("array")),
                ("items", obj(vec![("type", string("string"))])),
            ]),
        );
    }
    schema
}

fn scenario_workbench_schema() -> Json {
    obj(vec![
        ("type", string("object")),
        ("additionalProperties", Json::Bool(false)),
        (
            "required",
            Json::Array(vec![string("scenarios"), string("comparePairs")]),
        ),
        (
            "properties",
            obj(vec![
                (
                    "scenarios",
                    obj(vec![
                        ("type", string("array")),
                        ("minItems", Json::Number(1)),
                        ("items", scenario_input_schema()),
                    ]),
                ),
                (
                    "comparePairs",
                    obj(vec![
                        ("type", string("array")),
                        ("items", compare_pair_schema()),
                    ]),
                ),
                (
                    "excludePolicyScenarioIds",
                    obj(vec![
                        ("type", string("array")),
                        (
                            "description",
                            string(
                                "Scenario ids to omit from deterministic policyQueue construction.",
                            ),
                        ),
                        ("items", obj(vec![("type", string("string"))])),
                    ]),
                ),
            ]),
        ),
    ])
}

fn validate_policy_packet_schema() -> Json {
    let mut schema = scenario_workbench_schema();
    let Some(required) = schema.get_mut("required") else {
        return schema;
    };
    if let Json::Array(values) = required {
        values.push(string("packet"));
    }
    let Some(properties) = schema.get_mut("properties") else {
        return schema;
    };
    if let Json::Object(fields) = properties {
        fields.insert(
            "packet".to_string(),
            obj(vec![
                ("type", string("object")),
                (
                    "description",
                    string("Agent-produced workbench packet to validate against deterministic scenario inputs."),
                ),
            ]),
        );
    }
    schema
}

fn scenario_input_schema() -> Json {
    obj(vec![
        ("type", string("object")),
        ("additionalProperties", Json::Bool(false)),
        (
            "required",
            Json::Array(vec![string("id"), string("states")]),
        ),
        (
            "properties",
            obj(vec![
                ("id", obj(vec![("type", string("string"))])),
                (
                    "states",
                    obj(vec![
                        ("type", string("array")),
                        ("minItems", Json::Number(2)),
                        ("items", state_id_schema()),
                    ]),
                ),
                ("objective", obj(vec![("type", string("string"))])),
            ]),
        ),
    ])
}

fn compare_pair_schema() -> Json {
    obj(vec![
        ("type", string("object")),
        ("additionalProperties", Json::Bool(false)),
        (
            "required",
            Json::Array(vec![string("left"), string("right")]),
        ),
        (
            "properties",
            obj(vec![
                ("left", obj(vec![("type", string("string"))])),
                ("right", obj(vec![("type", string("string"))])),
            ]),
        ),
    ])
}

fn state_id_schema() -> Json {
    obj(vec![
        ("type", string("string")),
        ("pattern", string("^S64-[01]{6}$")),
    ])
}

#[derive(Debug, Clone, PartialEq)]
enum Json {
    Null,
    Bool(bool),
    Number(i64),
    Float(f64),
    String(String),
    Array(Vec<Json>),
    Object(BTreeMap<String, Json>),
}

impl Json {
    fn as_str(&self) -> Option<&str> {
        match self {
            Json::String(value) => Some(value),
            _ => None,
        }
    }

    fn as_array(&self) -> Option<&[Json]> {
        match self {
            Json::Array(values) => Some(values),
            _ => None,
        }
    }

    fn as_i64(&self) -> Option<i64> {
        match self {
            Json::Number(value) => Some(*value),
            _ => None,
        }
    }

    fn as_f64(&self) -> Option<f64> {
        match self {
            Json::Number(value) => Some(*value as f64),
            Json::Float(value) => Some(*value),
            _ => None,
        }
    }

    fn get(&self, key: &str) -> Option<&Json> {
        match self {
            Json::Object(fields) => fields.get(key),
            _ => None,
        }
    }

    fn get_mut(&mut self, key: &str) -> Option<&mut Json> {
        match self {
            Json::Object(fields) => fields.get_mut(key),
            _ => None,
        }
    }

    fn to_compact_string(&self) -> String {
        match self {
            Json::Null => "null".to_string(),
            Json::Bool(value) => value.to_string(),
            Json::Number(value) => value.to_string(),
            Json::Float(value) => {
                if value.is_finite() {
                    value.to_string()
                } else {
                    "null".to_string()
                }
            }
            Json::String(value) => json_string(value),
            Json::Array(values) => format!(
                "[{}]",
                values
                    .iter()
                    .map(Json::to_compact_string)
                    .collect::<Vec<_>>()
                    .join(",")
            ),
            Json::Object(fields) => format!(
                "{{{}}}",
                fields
                    .iter()
                    .map(|(key, value)| format!(
                        "{}:{}",
                        json_string(key),
                        value.to_compact_string()
                    ))
                    .collect::<Vec<_>>()
                    .join(",")
            ),
        }
    }

    fn to_pretty_string(&self, indent: usize) -> String {
        match self {
            Json::Array(values) => {
                if values.is_empty() {
                    return "[]".to_string();
                }
                let next = indent + 2;
                let inner = values
                    .iter()
                    .map(|value| format!("{}{}", " ".repeat(next), value.to_pretty_string(next)))
                    .collect::<Vec<_>>()
                    .join(",\n");
                format!("[\n{inner}\n{}]", " ".repeat(indent))
            }
            Json::Object(fields) => {
                if fields.is_empty() {
                    return "{}".to_string();
                }
                let next = indent + 2;
                let inner = fields
                    .iter()
                    .map(|(key, value)| {
                        format!(
                            "{}{}: {}",
                            " ".repeat(next),
                            json_string(key),
                            value.to_pretty_string(next)
                        )
                    })
                    .collect::<Vec<_>>()
                    .join(",\n");
                format!("{{\n{inner}\n{}}}", " ".repeat(indent))
            }
            _ => self.to_compact_string(),
        }
    }
}

fn obj(fields: Vec<(&str, Json)>) -> Json {
    Json::Object(
        fields
            .into_iter()
            .map(|(key, value)| (key.to_string(), value))
            .collect(),
    )
}

fn string(value: &str) -> Json {
    Json::String(value.to_string())
}

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

struct JsonParser<'a> {
    bytes: &'a [u8],
    pos: usize,
}

impl<'a> JsonParser<'a> {
    fn new(input: &'a str) -> Self {
        Self {
            bytes: input.as_bytes(),
            pos: 0,
        }
    }

    fn parse(&mut self) -> Result<Json, String> {
        let value = self.parse_value()?;
        self.skip_ws();
        if self.pos != self.bytes.len() {
            return Err("trailing characters after JSON value".to_string());
        }
        Ok(value)
    }

    fn parse_value(&mut self) -> Result<Json, String> {
        self.skip_ws();
        let Some(byte) = self.peek() else {
            return Err("unexpected end of input".to_string());
        };
        match byte {
            b'n' => self.literal(b"null", Json::Null),
            b't' => self.literal(b"true", Json::Bool(true)),
            b'f' => self.literal(b"false", Json::Bool(false)),
            b'"' => self.parse_string().map(Json::String),
            b'[' => self.parse_array(),
            b'{' => self.parse_object(),
            b'-' | b'0'..=b'9' => self.parse_number(),
            _ => Err("unexpected token in JSON value".to_string()),
        }
    }

    fn literal(&mut self, literal: &[u8], value: Json) -> Result<Json, String> {
        if self.bytes.get(self.pos..self.pos + literal.len()) == Some(literal) {
            self.pos += literal.len();
            Ok(value)
        } else {
            Err("invalid JSON literal".to_string())
        }
    }

    fn parse_object(&mut self) -> Result<Json, String> {
        self.expect(b'{')?;
        let mut fields = BTreeMap::new();
        self.skip_ws();
        if self.consume(b'}') {
            return Ok(Json::Object(fields));
        }
        loop {
            self.skip_ws();
            let key = self.parse_string()?;
            self.skip_ws();
            self.expect(b':')?;
            let value = self.parse_value()?;
            fields.insert(key, value);
            self.skip_ws();
            if self.consume(b'}') {
                break;
            }
            self.expect(b',')?;
        }
        Ok(Json::Object(fields))
    }

    fn parse_array(&mut self) -> Result<Json, String> {
        self.expect(b'[')?;
        let mut values = Vec::new();
        self.skip_ws();
        if self.consume(b']') {
            return Ok(Json::Array(values));
        }
        loop {
            values.push(self.parse_value()?);
            self.skip_ws();
            if self.consume(b']') {
                break;
            }
            self.expect(b',')?;
        }
        Ok(Json::Array(values))
    }

    fn parse_string(&mut self) -> Result<String, String> {
        self.expect(b'"')?;
        let mut out = String::new();
        while let Some(byte) = self.next() {
            match byte {
                b'"' => return Ok(out),
                b'\\' => {
                    let escaped = self
                        .next()
                        .ok_or_else(|| "unterminated JSON escape".to_string())?;
                    match escaped {
                        b'"' => out.push('"'),
                        b'\\' => out.push('\\'),
                        b'/' => out.push('/'),
                        b'b' => out.push('\u{0008}'),
                        b'f' => out.push('\u{000c}'),
                        b'n' => out.push('\n'),
                        b'r' => out.push('\r'),
                        b't' => out.push('\t'),
                        b'u' => out.push(self.parse_unicode_escape()?),
                        _ => return Err("invalid JSON escape".to_string()),
                    }
                }
                0x00..=0x1f => return Err("control character in JSON string".to_string()),
                _ => out.push(byte as char),
            }
        }
        Err("unterminated JSON string".to_string())
    }

    fn parse_unicode_escape(&mut self) -> Result<char, String> {
        let mut value = 0u32;
        for _ in 0..4 {
            let byte = self
                .next()
                .ok_or_else(|| "unterminated unicode escape".to_string())?;
            value = value * 16
                + match byte {
                    b'0'..=b'9' => (byte - b'0') as u32,
                    b'a'..=b'f' => (byte - b'a' + 10) as u32,
                    b'A'..=b'F' => (byte - b'A' + 10) as u32,
                    _ => return Err("invalid unicode escape".to_string()),
                };
        }
        char::from_u32(value).ok_or_else(|| "invalid unicode scalar".to_string())
    }

    fn parse_number(&mut self) -> Result<Json, String> {
        let start = self.pos;
        self.consume(b'-');
        self.consume_digits();
        let mut is_float = false;
        if self.consume(b'.') {
            is_float = true;
            self.consume_digits();
        }
        if matches!(self.peek(), Some(b'e' | b'E')) {
            is_float = true;
            self.pos += 1;
            if matches!(self.peek(), Some(b'+' | b'-')) {
                self.pos += 1;
            }
            self.consume_digits();
        }
        let token = std::str::from_utf8(&self.bytes[start..self.pos])
            .map_err(|_| "invalid number encoding".to_string())?;
        if is_float {
            token
                .parse::<f64>()
                .map(Json::Float)
                .map_err(|_| "invalid JSON number".to_string())
        } else {
            token
                .parse::<i64>()
                .map(Json::Number)
                .map_err(|_| "invalid JSON number".to_string())
        }
    }

    fn consume_digits(&mut self) {
        while matches!(self.peek(), Some(b'0'..=b'9')) {
            self.pos += 1;
        }
    }

    fn skip_ws(&mut self) {
        while matches!(self.peek(), Some(b' ' | b'\n' | b'\r' | b'\t')) {
            self.pos += 1;
        }
    }

    fn expect(&mut self, expected: u8) -> Result<(), String> {
        if self.consume(expected) {
            Ok(())
        } else {
            Err(format!("expected '{}'", expected as char))
        }
    }

    fn consume(&mut self, expected: u8) -> bool {
        if self.peek() == Some(expected) {
            self.pos += 1;
            true
        } else {
            false
        }
    }

    fn peek(&self) -> Option<u8> {
        self.bytes.get(self.pos).copied()
    }

    fn next(&mut self) -> Option<u8> {
        let byte = self.peek()?;
        self.pos += 1;
        Some(byte)
    }
}
