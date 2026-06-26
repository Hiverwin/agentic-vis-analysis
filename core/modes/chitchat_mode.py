"""闲聊模式实现"""
from typing import Dict
from core.vlm_service import get_vlm_service
from prompts import get_prompt_manager


class ChitchatMode:
    """闲聊模式"""
    
    def __init__(self):
        self.vlm = get_vlm_service()
        self.prompt_mgr = get_prompt_manager()
    
    def execute(self, user_query: str, image_base64: str = None, context: Dict = None) -> Dict:
        """执行闲聊响应（按DashScope标准多轮对话格式）"""
        system_prompt = self.prompt_mgr.get_base_system_role()
        chitchat_prompt = self.prompt_mgr.get_chitchat_prompt()
        full_system_prompt = f"{system_prompt}\n\n{chitchat_prompt}"
        
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
        
        # VLM调用
        response = self.vlm.call(messages, full_system_prompt, expect_json=False)
        
        if response.get("success"):
            # 追加assistant消息
            assistant_message = {
                "role": "assistant",
                "content": [{"text": response.get("content", "")}]
            }
            messages.append(assistant_message)
            
            # 保存到context
            if context is not None:
                context['chitchat_messages'] = messages
            
            return {
                "mode": "chitchat",
                "success": True,
                "response": response.get("content", ""),
                "raw_output": response.get("content", "")  # 闲聊模式原始输出就是回复
            }
        else:
            return {
                "mode": "chitchat",
                "success": False,
                "error": response.get("error", "Unknown error")
            }
