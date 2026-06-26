"""JSON处理工具"""
import json
from typing import Any

def safe_json_loads(json_str: str, default=None) -> Any:
    """安全地解析JSON"""
    try:
        return json.loads(json_str)
    except json.JSONDecodeError:
        return default

def safe_json_dumps(obj: Any, **kwargs) -> str:
    """安全地序列化为JSON"""
    try:
        return json.dumps(obj, ensure_ascii=False, **kwargs)
    except Exception as e:
        return "{}"

def extract_json_from_text(text: str) -> dict:
    """从文本中提取JSON（处理VLM返回的混合文本）"""
    # 优先提取字典，再提取数组
    start_markers = ['{', '[']
    end_markers = {'{': '}', '[': ']'}
    
    # 先尝试提取字典
    start_idx = text.find('{')
    if start_idx != -1:
        end_idx = text.rfind('}')
        if end_idx != -1 and end_idx > start_idx:
            json_str = text[start_idx:end_idx+1]
            result = safe_json_loads(json_str)
            if result and isinstance(result, dict):
                return result
    
    # 如果没有找到字典，再尝试提取数组
    start_idx = text.find('[')
    if start_idx != -1:
        end_idx = text.rfind(']')
        if end_idx != -1 and end_idx > start_idx:
            json_str = text[start_idx:end_idx+1]
            result = safe_json_loads(json_str)
            if result:
                # 如果是数组，返回空字典
                return {}
    
    return {}
