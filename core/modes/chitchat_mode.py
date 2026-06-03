"""闲聊模式实现"""
from typing import Callable, Dict, Optional
from dataclasses import asdict
from core.vlm_service import get_vlm_service
from prompts import get_prompt_manager
from agent.schemas import AgentKnowledge, AgentObservation
from core.event_types import AppEvents, emit_event


class ChitchatMode:
    """闲聊模式"""
    
    def __init__(self):
        self.vlm = get_vlm_service()
        self.prompt_mgr = get_prompt_manager()
    
    def execute(
        self,
        user_query: str,
        image_base64: str = None,
        context: Dict = None,
        event_callback: Optional[Callable[[str, Dict], None]] = None,
    ) -> Dict:
        """执行闲聊响应（按DashScope标准多轮对话格式）"""
        system_prompt = self.prompt_mgr.get_base_system_role()
        chitchat_prompt = self.prompt_mgr.get_chitchat_prompt()
        full_system_prompt = f"{system_prompt}\n\n{chitchat_prompt}\n\nImportant: All assistant outputs must be in English."
        agent_knowledge = AgentKnowledge(
            system_prompt=full_system_prompt,
            tool_registry=[],
            chart_specific_usage="chitchat",
        )
        
        # 从context读取messages历史
        messages = context.get('chitchat_messages', []) if context else []
        
        # 构建user消息
        if image_base64:
            user_message = {
                "role": "user",
                "content": [
                    {"text": user_query},
                    {"image": f"data:image/png;base64,{image_base64}"}
                ]
            }
        else:
            user_message = {
                "role": "user",
                "content": [{"text": user_query}]
            }
        
        messages.append(user_message)
        
        emit_event(event_callback, AppEvents.ITERATION_STARTED, {"iteration": 1})
        emit_event(
            event_callback,
            AppEvents.ITERATION_PHASE,
            {"iteration": 1, "phase": "observe", "summary": "Read user query"},
        )
        # VLM调用
        response = self.vlm.call(messages, full_system_prompt, expect_json=False)
        agent_observation = AgentObservation(
            user_query=user_query,
            widget_state={},
            rendered_view=image_base64 or "",
        )
        
        if response.get("success"):
            emit_event(
                event_callback,
                AppEvents.ITERATION_PHASE,
                {"iteration": 1, "phase": "reason", "summary": "Generate chitchat response"},
            )
            emit_event(
                event_callback,
                AppEvents.AGENT_MESSAGE,
                {
                    "iteration": 1,
                    "key_insights": [],
                    "reasoning": response.get("content", ""),
                },
            )
            # 追加assistant消息
            assistant_message = {
                "role": "assistant",
                "content": [{"text": response.get("content", "")}]
            }
            messages.append(assistant_message)
            
            # 保存到context
            if context is not None:
                context['chitchat_messages'] = messages
            
            emit_event(event_callback, AppEvents.ITERATION_FINISHED, {"iteration": 1})
            return {
                "mode": "chitchat",
                "success": True,
                "response": response.get("content", ""),
                "raw_output": response.get("content", ""),  # 闲聊模式原始输出就是回复
                "step_trace": [
                    {
                        "iteration": 1,
                        "observe": {"user_query": user_query},
                        "plan": {"stop_or_continue": "stop"},
                        "act": [],
                        "verify": [],
                        "reason": {"response": response.get("content", "")},
                        "observation_context": asdict(agent_observation),
                        "knowledge_context": asdict(agent_knowledge),
                        "tool_calls": [],
                        "state_updated": False,
                        "stop_signal": True,
                    }
                ],
                "stop_reason": "chitchat_response_generated",
                "degraded_completion": False,
                "_streamed_events": True,
            }
        else:
            emit_event(event_callback, AppEvents.ERROR, {"message": response.get("error", "Unknown error")})
            emit_event(event_callback, AppEvents.ITERATION_FINISHED, {"iteration": 1})
            return {
                "mode": "chitchat",
                "success": False,
                "error": response.get("error", "Unknown error"),
                "step_trace": [
                    {
                        "iteration": 1,
                        "observe": {"user_query": user_query},
                        "plan": {"stop_or_continue": "stop"},
                        "act": [],
                        "verify": [],
                        "reason": {"error": response.get("error", "Unknown error")},
                        "observation_context": asdict(agent_observation),
                        "knowledge_context": asdict(agent_knowledge),
                        "tool_calls": [],
                        "state_updated": False,
                        "stop_signal": True,
                    }
                ],
                "stop_reason": "vlm_error",
                "degraded_completion": True,
                "_streamed_events": True,
            }
