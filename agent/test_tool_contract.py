from agent.schemas import AgentKnowledge, AgentObservation
from agent.tool_contract import (
    SINGLE_WIDGET_AGENT_CONTRACT_VERSION,
    build_single_widget_agent_contract,
)


def test_build_single_widget_agent_contract_normalizes_defaults():
    contract = build_single_widget_agent_contract(
        widget={"ref": "widget://demo/scatter", "kind": "scatter"},
        action_descriptors=[{"name": "scatter.brushRegion"}],
        perception_descriptors=[{"name": "perception.inspectVisibleRows"}],
        verification_contract={"preferredReadMethod": "readVerificationState"},
    )

    payload = contract.to_dict()
    assert payload["version"] == SINGLE_WIDGET_AGENT_CONTRACT_VERSION
    assert payload["widget"]["ref"] == "widget://demo/scatter"
    assert payload["widget"]["kind"] == "scatter"
    assert payload["observe"]["observationMethodName"] == "readObservation"
    assert payload["act"]["verifiedActionMethodName"] == "executeVerifiedAction"
    assert payload["verify"]["verifyQueryName"] == "perception.verifyActionEffect"
    assert payload["catalog"]["availableActionNames"] == ["scatter.brushRegion"]
    assert payload["catalog"]["availablePerceptionNames"] == ["perception.inspectVisibleRows"]


def test_agent_observation_and_knowledge_accept_contract_context():
    observation = AgentObservation(
        user_query="Find outliers",
        widget_state={"kind": "scatter"},
        rendered_view="base64://image",
        widget_ref="widget://demo/scatter",
        widget_kind="scatter",
        action_contract={"version": SINGLE_WIDGET_AGENT_CONTRACT_VERSION},
    )
    knowledge = AgentKnowledge(
        system_prompt="system",
        tool_registry=[],
        chart_specific_usage="scatter",
        action_contract={"version": SINGLE_WIDGET_AGENT_CONTRACT_VERSION},
    )

    assert observation.widget_ref == "widget://demo/scatter"
    assert observation.widget_kind == "scatter"
    assert observation.action_contract["version"] == SINGLE_WIDGET_AGENT_CONTRACT_VERSION
    assert knowledge.preferred_action_surface == "executeAction"
    assert knowledge.preferred_verify_surface == "perception.verifyActionEffect"
