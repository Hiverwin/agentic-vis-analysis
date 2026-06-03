"""
意图类型枚举
定义系统能够识别的所有用户意图类型
"""

from enum import Enum
from typing import Dict, Any
from dataclasses import dataclass


class IntentType(Enum):
    """用户意图类型枚举"""
    
    # 闲聊意图
    CHITCHAT = "chitchat"
    
    # 分析意图 - 明确型
    EXPLICIT_ANALYSIS = "explicit_analysis"
    
    # 分析意图 - 模糊型
    VAGUE_EXPLORATION = "vague_exploration"
    
    # 未知意图
    UNKNOWN = "unknown"
    
    def __str__(self):
        return self.value
    
    @classmethod
    def from_string(cls, intent: str) -> 'IntentType':
        """从字符串转换为枚举类型"""
        intent_lower = intent.lower().replace(' ', '_').replace('-', '_')
        for it in cls:
            if it.value == intent_lower:
                return it
        return cls.UNKNOWN
    
    def is_analytical(self) -> bool:
        """判断是否为分析意图"""
        return self in [IntentType.EXPLICIT_ANALYSIS, IntentType.VAGUE_EXPLORATION]
    
    def is_chitchat(self) -> bool:
        """判断是否为闲聊意图"""
        return self == IntentType.CHITCHAT


@dataclass
class IntentConfig:
    """意图配置"""
    name: str
    display_name: str
    description: str
    execution_mode: str  # 执行模式: 'direct', 'goal_oriented', 'autonomous_exploration'
    requires_tools: bool  # 是否需要工具支持
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            'name': self.name,
            'display_name': self.display_name,
            'description': self.description,
            'execution_mode': self.execution_mode,
            'requires_tools': self.requires_tools
        }


# 意图类型详细配置
INTENT_CONFIGS = {
    IntentType.CHITCHAT: IntentConfig(
        name="chitchat",
        display_name="闲聊",
        description="用户进行普通对话、问候或非分析性询问",
        execution_mode="direct",
        requires_tools=False
    ),
    
    IntentType.EXPLICIT_ANALYSIS: IntentConfig(
        name="explicit_analysis",
        display_name="明确分析",
        description="用户有明确的分析目标和具体操作需求",
        execution_mode="goal_oriented",
        requires_tools=True
    ),
    
    IntentType.VAGUE_EXPLORATION: IntentConfig(
        name="vague_exploration",
        display_name="模糊探索",
        description="用户意图不明确，需要系统自主探索数据",
        execution_mode="autonomous_exploration",
        requires_tools=True
    )
}


def get_intent_config(intent_type: IntentType) -> IntentConfig:
    """获取意图配置"""
    return INTENT_CONFIGS.get(intent_type, None)


def get_execution_mode(intent_type: IntentType) -> str:
    """获取意图对应的执行模式"""
    config = get_intent_config(intent_type)
    return config.execution_mode if config else "direct"


def requires_tool_support(intent_type: IntentType) -> bool:
    """判断意图是否需要工具支持"""
    config = get_intent_config(intent_type)
    return config.requires_tools if config else False


# 意图识别的关键词映射（辅助识别）
INTENT_KEYWORDS = {
    IntentType.CHITCHAT: [
        "你好", "hi", "hello", "谢谢", "thanks", "再见", "bye",
        "怎么样", "如何", "介绍", "是什么", "能做什么"
    ],
    
    IntentType.EXPLICIT_ANALYSIS: [
        "筛选", "过滤", "filter", "zoom", "放大", "缩小",
        "高亮", "highlight", "排序", "sort", "显示", "show",
        "找出", "find", "查看", "view", "对比", "compare",
        "2020年到2022年", "前10", "top", "最大", "最小"
    ],
    
    IntentType.VAGUE_EXPLORATION: [
        "有什么", "什么样", "如何", "帮我看看", "分析一下",
        "有意思", "interesting", "insights", "发现", "discover",
        "模式", "pattern", "趋势", "trend", "特点", "feature",
        "探索", "explore", "了解", "understand"
    ]
}


def get_intent_keywords(intent_type: IntentType) -> list:
    """获取意图对应的关键词"""
    return INTENT_KEYWORDS.get(intent_type, [])
