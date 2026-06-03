"""
工具执行器（简化版）
"""

from typing import Dict, Any, List
import inspect
import traceback
from .tool_registry import tool_registry


class ToolExecutor:
    """工具执行器类"""
    
    def __init__(self):
        self.registry = tool_registry
        self.execution_history: List[Dict[str, Any]] = []
        self._param_aliases: Dict[str, Dict[str, str]] = {
            # common alias compatibility
            'change_encoding': {
                'field_type': 'type',
                'encoding_type': 'type',
                'dtype': 'type',
            },
            # bar
            'filter_categories': {
                'category': 'categories',
                'values': 'categories',
            },
            'expand_stack': {
                'categories': 'category',
            },
            'highlight_top_n': {
                # category belongs to expand_stack; ignore for compatibility instead of failing
                'category': '__drop__',
            },
            # line
            'filter_lines': {
                'lines': 'lines_to_remove',
            },
            'focus_lines': {
                'line_names': 'lines',
                'lines_to_highlight': 'lines',
            },
            # scatter
            'filter_categorical': {
                'categories': 'categories_to_remove',
                'remove_categories': 'categories_to_remove',
                'column': 'field',
                'category_field': 'field',
            },
            # parallel
            'filter_by_category': {
                'column': 'field',
                'dimension': 'field',
                'categories': 'values',
            },
            'highlight_category': {
                'column': 'field',
                'dimension': 'field',
                'categories': 'values',
            },
            'filter_dimension': {
                'value_range': 'range',
                'interval': 'range',
                'field': 'dimension',
                'column': 'dimension',
            },
            # sankey
            'collapse_nodes': {
                'nodes': 'nodes_to_collapse',
                'node_names': 'nodes_to_collapse',
            },
        }
    
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

        tool_function = tool_info['function']
        params = self._normalize_params(tool_name, params)
        params = self._filter_unknown_params(tool_function, params)
        
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

    def _normalize_params(self, tool_name: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Normalize historical aliases to canonical parameter names."""
        if not isinstance(params, dict):
            return {}
        normalized = dict(params)
        aliases = self._param_aliases.get(tool_name, {})
        for src, dst in aliases.items():
            if src not in normalized:
                continue
            value = normalized.pop(src)
            if dst == '__drop__':
                continue
            if dst in normalized:
                continue
            # lightweight coercion for common scalar/list mismatches
            if dst in ('categories', 'lines_to_remove', 'nodes_to_collapse') and not isinstance(value, list):
                value = [value]
            if dst == 'category' and isinstance(value, list):
                value = value[0] if value else ''
            normalized[dst] = value
        return normalized

    def _filter_unknown_params(self, tool_function: Any, params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Drop unknown kwargs for strict_compat mode.
        This prevents runtime TypeError on legacy/extra parameter names.
        """
        try:
            sig = inspect.signature(tool_function)
        except Exception:
            return params
        if any(p.kind == inspect.Parameter.VAR_KEYWORD for p in sig.parameters.values()):
            return params
        allowed = set(sig.parameters.keys())
        return {k: v for k, v in params.items() if k in allowed}
    
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
