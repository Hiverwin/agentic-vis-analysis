"""
工具执行器（简化版）
"""

from typing import Dict, Any, List
import traceback
from .tool_registry import tool_registry


class ToolExecutor:
    """工具执行器类"""
    
    def __init__(self):
        self.registry = tool_registry
        self.execution_history: List[Dict[str, Any]] = []
    
    def execute(self, tool_name: str, params: Dict[str, Any], validate: bool = True) -> Dict[str, Any]:
        """
        执行工具
        
        Args:
            tool_name: 工具名称
            params: 参数字典（state 通过 vega_spec 键传入）
            validate: 是否验证参数
            
        Returns:
            执行结果（包含 vega_spec 如果工具修改了它）
        """
        tool_info = self.registry.get_tool(tool_name)
        
        if not tool_info:
            return {
                'success': False,
                'error': f'Tool "{tool_name}" not found',
                'available_tools': self.registry.list_all_tools()
            }
        
        # 参数验证
        if validate:
            validation_result = self._validate_params(tool_name, params)
            if not validation_result['valid']:
                return {
                    'success': False,
                    'error': 'Parameter validation failed',
                    'details': validation_result['errors']
                }
        
        # 填充默认参数
        params = self._fill_default_params(tool_info, params)
        
        # 执行工具
        try:
            tool_function = tool_info['function']
            result = tool_function(**params)
            
            # 记录执行历史
            self._record_execution(tool_name, params, result, success=True)
            
            return result
            
        except Exception as e:
            error_result = {
                'success': False,
                'error': str(e),
                'traceback': traceback.format_exc()
            }
            
            self._record_execution(tool_name, params, error_result, success=False)
            
            return error_result
    
    def _validate_params(self, tool_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """验证参数"""
        tool_info = self.registry.get_tool(tool_name)
        param_specs = tool_info.get('params', {})
        
        errors = []
        
        # 检查必需参数（兼容 state / vega_spec 双写法）
        for param_name, param_spec in param_specs.items():
            if param_spec.get('required', False):
                has_param = param_name in params
                if not has_param and param_name == 'state':
                    has_param = 'vega_spec' in params
                elif not has_param and param_name == 'vega_spec':
                    has_param = 'state' in params
                if not has_param:
                    errors.append(f'Missing required parameter: {param_name}')
        
        return {
            'valid': len(errors) == 0,
            'errors': errors
        }
    
    def _fill_default_params(self, tool_info: Dict[str, Any], params: Dict[str, Any]) -> Dict[str, Any]:
        """填充默认参数"""
        param_specs = tool_info.get('params', {})
        filled_params = params.copy()
        
        for param_name, param_spec in param_specs.items():
            if param_name not in filled_params and 'default' in param_spec:
                filled_params[param_name] = param_spec['default']
        
        return filled_params
    
    def _record_execution(self, tool_name: str, params: Dict[str, Any], 
                         result: Dict[str, Any], success: bool):
        """记录执行历史"""
        from datetime import datetime
        
        # 不记录大对象以节省内存
        params_for_log = {k: v for k, v in params.items() if k not in ('vega_spec', 'state')}
        result_for_log = {k: v for k, v in result.items() if k not in ('vega_spec', 'state')}
        
        record = {
            'timestamp': datetime.now().isoformat(),
            'tool_name': tool_name,
            'params': params_for_log,
            'result': result_for_log,
            'success': success
        }
        
        self.execution_history.append(record)
        
        # 限制历史记录数量
        if len(self.execution_history) > 100:
            self.execution_history = self.execution_history[-100:]
    
    def execute_batch(self, tool_calls: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """批量执行工具"""
        results = []
        
        for tool_call in tool_calls:
            tool_name = tool_call.get('tool')
            params = tool_call.get('params', {})
            
            if not tool_name:
                results.append({'success': False, 'error': 'Tool name not specified'})
                continue
            
            result = self.execute(tool_name, params)
            results.append(result)
        
        return results
    
    def get_execution_history(self, limit: int = 10, tool_name: str = None) -> List[Dict[str, Any]]:
        """获取执行历史"""
        history = self.execution_history
        
        if tool_name:
            history = [r for r in history if r['tool_name'] == tool_name]
        
        return history[-limit:]
    
    def clear_history(self):
        """清空执行历史"""
        self.execution_history = []


_tool_executor = None

def get_tool_executor() -> ToolExecutor:
    """获取工具执行器单例"""
    global _tool_executor
    if _tool_executor is None:
        _tool_executor = ToolExecutor()
    return _tool_executor
