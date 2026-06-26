"""
VLM调用服务（DashScope API封装）
注意：需要安装 pip install dashscope --break-system-packages
"""

from typing import Dict, List, Any, Optional
import json

# 尝试导入dashscope，如果未安装则提供mock
try:
    import dashscope
    from dashscope import MultiModalConversation
    DASHSCOPE_AVAILABLE = True
except ImportError:
    DASHSCOPE_AVAILABLE = False
    print("Warning: dashscope not installed. Using mock VLM service.")

from config.settings import Settings
from core.utils import app_logger, extract_json_from_text


class VLMService:
    """VLM调用服务"""
    
    def __init__(self):
        if DASHSCOPE_AVAILABLE:
            dashscope.api_key = Settings.DASHSCOPE_API_KEY
        self.model = Settings.VLM_MODEL
        self.max_tokens = Settings.VLM_MAX_TOKENS
        self.temperature = Settings.VLM_TEMPERATURE
        app_logger.info(f"VLM Service initialized: {self.model}")
    
    def call(self, messages: List[Dict], system_prompt: str = None, 
             expect_json: bool = False) -> Dict:
        """调用VLM"""
        if not DASHSCOPE_AVAILABLE:
            return self._mock_call(messages, system_prompt, expect_json)
        
        try:
            api_messages = self._prepare_messages(messages, system_prompt)
            response = MultiModalConversation.call(
                model=self.model,
                messages=api_messages,
                max_tokens=self.max_tokens,
                temperature=self.temperature
            )
            
            if response.status_code == 200:
                content = response.output.choices[0].message.content[0]["text"]
                
                # 📊 添加日志：打印VLM原始输出
                app_logger.info(f"🤖 VLM原始输出前500字符: {content[:500]}")
                
                result = {"success": True, "content": content}
                if expect_json:
                    result["parsed_json"] = extract_json_from_text(content)
                return result
            else:
                # 📊 添加日志：打印错误详情
                app_logger.error(f"❌ VLM API错误: status={response.status_code}, message={response.message}")
                return {"success": False, "error": response.message}
        except Exception as e:
            app_logger.error(f"❌ VLM调用异常: {str(e)}", exc_info=True)
            return {"success": False, "error": str(e)}
    
    def _prepare_messages(self, messages: List, system_prompt: str = None) -> List:
        """准备API消息格式"""
        api_messages = []
        if system_prompt:
            api_messages.append({"role": "system", "content": [{"text": system_prompt}]})
        
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", [])
            if isinstance(content, str):
                content = [{"text": content}]
            api_messages.append({"role": role, "content": content})
        return api_messages
    
    def _mock_call(self, messages, system_prompt, expect_json):
        """Mock调用（用于测试）"""
        mock_response = {
            "success": True,
            "content": "这是一个模拟响应。请安装dashscope包以使用真实的VLM服务。"
        }
        if expect_json:
            mock_response["parsed_json"] = {"mock": True}
        return mock_response
    
    def call_with_image(self, text: str, image_base64: str, 
                       system_prompt: str = None, expect_json: bool = False):
        """便捷方法：文本+图像"""
        messages = [{
            "role": "user",
            "content": [
                {"text": text},
                {"image": f"data:image/png;base64,{image_base64}"}
            ]
        }]
        return self.call(messages, system_prompt, expect_json)
    
    def call_text_only(self, text: str, system_prompt: str = None, 
                       expect_json: bool = False):
        """便捷方法：仅文本"""
        messages = [{"role": "user", "content": [{"text": text}]}]
        return self.call(messages, system_prompt, expect_json)


_vlm_service = None

def get_vlm_service() -> VLMService:
    """获取VLM服务单例"""
    global _vlm_service
    if _vlm_service is None:
        _vlm_service = VLMService()
    return _vlm_service
