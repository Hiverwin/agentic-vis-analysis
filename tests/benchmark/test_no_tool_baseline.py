from benchmark.runner import build_no_tool_messages


def test_no_tool_messages_attach_the_captured_observation_image_without_widget_state():
    observation = {
        "state": {
            "widgets": [{"ref": "wl://workspace/main/widget/w_scatter", "kind": "scatter"}],
        },
        "view": {
            "image": {
                "mimeType": "image/png",
                "data": "data:image/png;base64,c2FtZS1pbWFnZQ==",
            },
        },
    }

    messages = build_no_tool_messages(
        objective="What is the highest visible value?",
        observation=observation,
        response_requirements={"mode": "verifiable", "answerType": "numeric"},
    )

    assert messages[1]["content"][1] == {
        "type": "image_url",
        "image_url": {"url": "data:image/png;base64,c2FtZS1pbWFnZQ=="},
    }
    assert "wl://workspace/main/widget/w_scatter" not in messages[1]["content"][0]["text"]
    assert '"answerType": "numeric"' in messages[1]["content"][0]["text"]
