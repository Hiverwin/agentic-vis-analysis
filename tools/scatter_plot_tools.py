"""
散点图专用工具
"""

from typing import List, Dict, Any, Tuple, Optional
import numpy as np
import copy
import json
from sklearn.cluster import KMeans
from scipy.stats import pearsonr, spearmanr
from state_manager import DataStore, tool_output
from tools.common import _apply_filters, _get_spec_data


def _datum_ref(field: str) -> str:
    """Vega expr: datum access for field names with spaces/special chars."""
    if not field:
        return "datum"
    s = str(field).replace("\\", "\\\\").replace("'", "\\'")
    return f"datum['{s}']"


def _main_encoding_dict(state: Dict) -> Dict[str, Any]:
    """Prefer layer[0].encoding after show_regression (layered spec)."""
    if isinstance(state.get("layer"), list) and state["layer"]:
        le = state["layer"][0].get("encoding")
        if isinstance(le, dict) and le:
            return le
    enc = state.get("encoding")
    return enc if isinstance(enc, dict) else {}


def _set_main_encoding(state: Dict, encoding: Dict) -> None:
    """Keep top-level encoding in sync with layer[0] for tools that only updated one."""
    enc = copy.deepcopy(encoding)
    if isinstance(state.get("layer"), list) and state["layer"] and isinstance(state["layer"][0], dict):
        state["layer"][0]["encoding"] = copy.deepcopy(enc)
    state["encoding"] = enc



def identify_clusters(state: Dict, n_clusters: int = 3, method: str = "kmeans") -> Dict[str, Any]:
    """识别数据聚类"""
    new_state = copy.deepcopy(state)
    
    x_field = new_state.get('encoding', {}).get('x', {}).get('field')
    y_field = new_state.get('encoding', {}).get('y', {}).get('field')
    
    if not x_field or not y_field:
        return {'success': False, 'error': 'Cannot find required fields'}

    data = _get_filtered_data(new_state)
    
    points = []
    valid_indices = []
    for i, row in enumerate(data):
        if row.get(x_field) is not None and row.get(y_field) is not None:
            points.append([row[x_field], row[y_field]])
            valid_indices.append(i)
    
    if len(points) < n_clusters:
        return {'success': False, 'error': f'Not enough points for {n_clusters} clusters'}
    
    points_array = np.array(points)
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    labels = kmeans.fit_predict(points_array)
    centers = kmeans.cluster_centers_
    
    cluster_field = f'cluster_{n_clusters}'
    for i, label in enumerate(labels):
        data[valid_indices[i]][cluster_field] = int(label)
    
    new_state['data'] = {'values': data}
    new_state['encoding']['color'] = {
        'field': cluster_field,
        'type': 'nominal',
        'scale': {'scheme': 'category10'},
        'legend': {'title': 'Cluster'}
    }
    
    cluster_stats = []
    for i in range(n_clusters):
        cluster_points = points_array[labels == i]
        cluster_stats.append({
            'cluster_id': i,
            'size': len(cluster_points),
            'center': centers[i].tolist()
        })
    
    return {
        'success': True,
        'operation': 'identify_clusters',
        'vega_state': new_state,
        'n_clusters': n_clusters,
        'cluster_statistics': cluster_stats,
        'message': f'Identified {n_clusters} clusters'
    }


def calculate_correlation(state: Dict, method: str = "pearson") -> Dict[str, Any]:
    """计算相关系数

    支持在 filter / zoom / brush / change_encoding 之后对局部数据计算：
    - filter_categorical：只对过滤后保留的数据计算
    - zoom_2d_region：对缩放后可见的数据计算
    - select_region / brush_region：只对选中区域内的数据计算
    """
    x_field = state.get('encoding', {}).get('x', {}).get('field')
    y_field = state.get('encoding', {}).get('y', {}).get('field')
    if isinstance(state.get('layer'), list) and state['layer']:
        enc = state['layer'][0].get('encoding', {})
        if enc:
            x_field = x_field or enc.get('x', {}).get('field')
            y_field = y_field or enc.get('y', {}).get('field')

    if not x_field or not y_field:
        return {'success': False, 'error': 'Cannot find required fields'}

    # 先应用 transform filter（filter_categorical 等），再应用选中区域
    data = _get_filtered_data(state)

    selected = state.get('_selected_region')
    region_info = ""
    if selected:
        x_min, x_max = selected['x_range']
        y_min, y_max = selected['y_range']
        data = [row for row in data
                if row.get(x_field) is not None and row.get(y_field) is not None
                and x_min <= row[x_field] <= x_max
                and y_min <= row[y_field] <= y_max]
        region_info = f" (in selected region: {len(data)} points)"
    
    x_values = [row[x_field] for row in data if row.get(x_field) is not None and row.get(y_field) is not None]
    y_values = [row[y_field] for row in data if row.get(x_field) is not None and row.get(y_field) is not None]
    
    if len(x_values) < 2:
        return {'success': False, 'error': f'Not enough data points{region_info}'}
    
    x_array = np.array(x_values)
    y_array = np.array(y_values)
    
    if method == "pearson":
        correlation, p_value = pearsonr(x_array, y_array)
    elif method == "spearman":
        correlation, p_value = spearmanr(x_array, y_array)
    else:
        return {'success': False, 'error': f'Unsupported method: {method}'}
    
    strength = "strong" if abs(correlation) >= 0.7 else "moderate" if abs(correlation) >= 0.4 else "weak"
    direction = "positive" if correlation > 0 else "negative"
    
    return {
        'success': True,
        'operation': 'calculate_correlation',
        'method': method,
        'correlation_coefficient': float(correlation),
        'p_value': float(p_value),
        'strength': strength,
        'direction': direction,
        'data_points': len(x_values),
        'selected_region': selected is not None,
        'message': f'{method} correlation: {correlation:.3f} ({strength} {direction}){region_info}'
    }


def zoom_2d_region(state: Dict, x_range: Tuple[float, float], y_range: Tuple[float, float]) -> Dict[str, Any]:
    """Zooms the specified view to a particular area by filtering data and adjusting axis scales.
    
    This focuses the visualization on a specific rectangular region.
    
    Args:
        state: The Vega-Lite specification
        x_range: Tuple of (min, max) for x-axis range
        y_range: Tuple of (min, max) for y-axis range
        
    Returns:
        Dict containing success status, filtered state, and statistics
    """
    new_state = copy.deepcopy(state)
    
    enc = _main_encoding_dict(new_state)
    x_field = enc.get('x', {}).get('field')
    y_field = enc.get('y', {}).get('field')
    
    if not x_field or not y_field:
        return {'success': False, 'error': 'Cannot find required x or y fields'}
    
    # 使用 filter 后的数据（支持 filter_categorical 后再 zoom）
    data = _get_filtered_data(new_state)
    if not data:
        return {'success': False, 'error': 'No data found in specification'}
    
    original_count = len(data)
    
    # Filter data: only keep points within the specified range
    filtered_data = [
        point for point in data
        if (point.get(x_field) is not None and 
            point.get(y_field) is not None and
            x_range[0] <= point[x_field] <= x_range[1] and
            y_range[0] <= point[y_field] <= y_range[1])
    ]
    
    filtered_count = len(filtered_data)
    
    if filtered_count == 0:
        return {
            'success': False,
            'error': f'No data points found in range x:[{x_range[0]}, {x_range[1]}], y:[{y_range[0]}, {y_range[1]}]',
            'original_count': original_count,
            'filtered_count': 0
        }
    
    # Update data in spec
    new_state['data'] = {'values': filtered_data}
    
    # Adjust axis scales to the specified range (sync layer[0] when present)
    enc_update = copy.deepcopy(enc)
    for axis, vals in [('x', x_range), ('y', y_range)]:
        if axis not in enc_update:
            enc_update[axis] = {}
        if 'scale' not in enc_update[axis]:
            enc_update[axis]['scale'] = {}
        enc_update[axis]['scale']['domain'] = [vals[0], vals[1]]
    _set_main_encoding(new_state, enc_update)
    
    return {
        'success': True,
        'operation': 'zoom_2d_region',
        'vega_state': new_state,
        'original_count': original_count,
        'filtered_count': filtered_count,
        'zoom_range': {
            'x': list(x_range),
            'y': list(y_range)
        },
        'message': f'Zoomed to dense area: showing {filtered_count} out of {original_count} points ({filtered_count/original_count*100:.1f}%)'
    }


def filter_categorical(state: Dict, categories_to_remove: List[str], field: str = None) -> Dict[str, Any]:
    """
    过滤掉指定类别的数据点
    
    Args:
        state: Vega-Lite规范
        categories_to_remove: 要移除的类别列表
        field: 分类字段名（可选，自动探测 color 字段）
    """
    import json
    new_state = copy.deepcopy(state)
    
    # 自动探测分类字段
    if field is None:
        encoding = new_state.get('encoding', {})
        color_enc = encoding.get('color', {})
        field = color_enc.get('field')
        
        if not field:
            # 尝试从 shape 字段获取
            shape_enc = encoding.get('shape', {})
            field = shape_enc.get('field')
    
    if not field:
        return {
            'success': False,
            'error': 'Cannot find categorical field. Please specify field parameter.'
        }
    
    if not isinstance(categories_to_remove, list) or len(categories_to_remove) == 0:
        return {
            'success': False,
            'error': 'categories_to_remove must be a non-empty list'
        }

    # Validate categories against current filtered view so no-op calls are not marked as success.
    current_data = _get_filtered_data(new_state)
    if not current_data:
        return {
            'success': False,
            'error': 'No data available in current view'
        }

    unique_values = []
    seen = set()
    for row in current_data:
        value = row.get(field)
        key = json.dumps(value, ensure_ascii=False, default=str)
        if key in seen:
            continue
        seen.add(key)
        unique_values.append(value)

    # Normalize common binary category aliases (yes/no, true/false, presence/absence).
    alias_to_binary = {
        'yes': 1, 'true': 1, 'presence': 1, 'present': 1, 'with': 1, 'disease': 1,
        'no': 0, 'false': 0, 'absence': 0, 'absent': 0, 'without': 0, 'healthy': 0,
    }

    normalized_targets = []
    for category in categories_to_remove:
        normalized_targets.append(category)
        if isinstance(category, str):
            s = category.strip()
            if not s:
                continue
            # numeric-like aliases
            try:
                n = float(s)
                normalized_targets.append(int(n) if n.is_integer() else n)
            except Exception:
                pass
            # yes/no -> 1/0 aliases
            mapped = alias_to_binary.get(s.lower())
            if mapped is not None:
                normalized_targets.append(mapped)

    matched_values = []
    matched_seen = set()
    for uv in unique_values:
        for target in normalized_targets:
            if uv == target:
                mk = json.dumps(uv, ensure_ascii=False, default=str)
                if mk not in matched_seen:
                    matched_seen.add(mk)
                    matched_values.append(uv)
                break
            if isinstance(uv, str) and isinstance(target, str) and uv.strip().lower() == target.strip().lower():
                mk = json.dumps(uv, ensure_ascii=False, default=str)
                if mk not in matched_seen:
                    matched_seen.add(mk)
                    matched_values.append(uv)
                break

    if not matched_values:
        preview = unique_values[:8]
        return {
            'success': False,
            'error': f'None of categories {categories_to_remove} match field "{field}" in current view. Available sample values: {preview}'
        }

    # 添加 filter transform
    if 'transform' not in new_state:
        new_state['transform'] = []
    
    categories_json = json.dumps(matched_values, ensure_ascii=False)
    new_state['transform'].append({
        'filter': f'indexof({categories_json}, {_datum_ref(field)}) < 0'
    })

    removed_count = sum(1 for row in current_data if row.get(field) in matched_values)
    if removed_count <= 0:
        return {
            'success': False,
            'error': f'Filter is a no-op for field "{field}" with categories {categories_to_remove}'
        }
    
    return {
        'success': True,
        'operation': 'filter_categorical',
        'vega_state': new_state,
        'removed_count': removed_count,
        'resolved_categories': matched_values,
        'message': f'Filtered out categories: {matched_values} from field {field} (matched from request {categories_to_remove})'
    }


def select_region(state: Dict, x_range: Tuple[float, float], y_range: Tuple[float, float]) -> Dict[str, Any]:
    """
    选中指定区域内的点，区域内高亮、区域外变淡。
    
    后续调用 calculate_correlation 将只计算选中区域内的数据。
    
    Args:
        state: Vega-Lite 规范
        x_range: X 轴范围 (min, max)
        y_range: Y 轴范围 (min, max)
    """
    new_state = copy.deepcopy(state)
    enc = _main_encoding_dict(new_state)
    x_field = enc.get('x', {}).get('field')
    y_field = enc.get('y', {}).get('field')
    if not x_field or not y_field:
        return {'success': False, 'error': 'Cannot find required fields'}
    data = _get_filtered_data(new_state)
    selected_count = sum(
        1 for row in data
        if row.get(x_field) is not None and row.get(y_field) is not None
        and x_range[0] <= row[x_field] <= x_range[1]
        and y_range[0] <= row[y_field] <= y_range[1]
    )
    xr, yr = _datum_ref(x_field), _datum_ref(y_field)
    enc_sel = copy.deepcopy(enc)
    enc_sel['opacity'] = {
        'condition': {
            'test': f'{xr} >= {x_range[0]} && {xr} <= {x_range[1]} && {yr} >= {y_range[0]} && {yr} <= {y_range[1]}',
            'value': 1.0
        },
        'value': 0.2
    }
    _set_main_encoding(new_state, enc_sel)
    # 保存选中区域元数据，供后续 calculate_correlation 使用
    new_state['_selected_region'] = {
        'x_range': list(x_range),
        'y_range': list(y_range),
        'x_field': x_field,
        'y_field': y_field
    }
    return {
        'success': True,
        'operation': 'select_region',
        'vega_state': new_state,
        'selected_count': selected_count,
        'message': f'Selected {selected_count} points'
    }


def brush_region(state: Dict, x_range: Tuple[float, float], y_range: Tuple[float, float]) -> Dict[str, Any]:
    """
    刷选特定区域，区域外数据点变淡
    
    后续调用 calculate_correlation 将只计算刷选区域内的数据。
    
    Args:
        state: Vega-Lite规范
        x_range: X轴范围 (min, max)
        y_range: Y轴范围 (min, max)
    """
    new_state = copy.deepcopy(state)
    
    enc = _main_encoding_dict(new_state)
    x_field = enc.get('x', {}).get('field')
    y_field = enc.get('y', {}).get('field')
    
    if not x_field or not y_field:
        return {'success': False, 'error': 'Cannot find x or y fields'}

    # 统计刷选区域内的数据点数量（使用 filter 后的数据）
    data = _get_filtered_data(new_state)
    brushed_count = sum(
        1 for row in data
        if row.get(x_field) is not None and row.get(y_field) is not None
        and x_range[0] <= row[x_field] <= x_range[1]
        and y_range[0] <= row[y_field] <= y_range[1]
    )
    
    # 通过 opacity 条件编码实现刷选效果（支持含空格的字段名）
    xr, yr = _datum_ref(x_field), _datum_ref(y_field)
    enc_brush = copy.deepcopy(enc)
    enc_brush['opacity'] = {
        'condition': {
            'test': f'{xr} >= {x_range[0]} && {xr} <= {x_range[1]} && {yr} >= {y_range[0]} && {yr} <= {y_range[1]}',
            'value': 1.0
        },
        'value': 0.15
    }
    _set_main_encoding(new_state, enc_brush)
    
    # 保存刷选区域元数据，供后续 calculate_correlation 使用
    new_state['_selected_region'] = {
        'x_range': list(x_range),
        'y_range': list(y_range),
        'x_field': x_field,
        'y_field': y_field
    }
    
    return {
        'success': True,
        'operation': 'brush_region',
        'vega_state': new_state,
        'brushed_count': brushed_count,
        'message': f'Brushed region x:[{x_range[0]}, {x_range[1]}], y:[{y_range[0]}, {y_range[1]}] ({brushed_count} points)'
    }


def change_encoding(state: Dict, channel: str, field: str, type: Optional[str] = None) -> Dict[str, Any]:
    """
    Modify the field mapping of the specified encoding channel
    
    Args:
        state: Vega spec
        channel: encoding channel ("x", "y", "color", "size", "shape")
        field: new field name
    """
    new_state = copy.deepcopy(state)
    
    # 检查字段是否存在（兼容大小写差异）
    data = _get_data_values(new_state)
    resolved_field = field
    if data:
        available_fields = list(data[0].keys())
        if field not in data[0]:
            lowered = str(field).strip().lower()
            for candidate in available_fields:
                if str(candidate).strip().lower() == lowered:
                    resolved_field = candidate
                    break
        if resolved_field not in data[0]:
            return {
                'success': False,
                'error': f'Field "{field}" not found in data. Available fields: {available_fields}'
            }
    
    # 使用传入 type 或根据数据推断字段类型
    valid_types = ('quantitative', 'nominal', 'ordinal', 'temporal')
    if type and type in valid_types:
        field_type = type
    else:
        field_type = 'nominal'
        if data:
            sample_value = data[0].get(resolved_field)
            if isinstance(sample_value, (int, float)):
                field_type = 'quantitative'
            elif isinstance(sample_value, str):
                if any(sep in sample_value for sep in ['-', '/', ':']):
                    field_type = 'temporal'
    
    enc = _main_encoding_dict(new_state)
    if not enc:
        enc = {}
    enc[channel] = {
        'field': resolved_field,
        'type': field_type
    }
    
    # 为特定通道添加额外配置
    if channel == 'color':
        enc[channel]['legend'] = {'title': resolved_field}
        if field_type == 'quantitative':
            enc[channel]['scale'] = {'scheme': 'viridis'}
    elif channel == 'size':
        if field_type == 'quantitative':
            enc[channel]['scale'] = {'range': [50, 500]}
    
    _set_main_encoding(new_state, enc)
    
    return {
        'success': True,
        'operation': 'change_encoding',
        'vega_state': new_state,
        'message': f'Changed {channel} encoding to field "{resolved_field}" (type: {field_type})'
    }


def show_regression(state: Dict, method: str = "linear") -> Dict[str, Any]:
    """
    叠加回归线
    
    Args:
        state: Vega-Lite规范
        method: 回归方法 ("linear", "log", "exp", "poly", "quad")
    """
    new_state = copy.deepcopy(state)
    
    enc = _main_encoding_dict(new_state)
    x_field = enc.get('x', {}).get('field')
    y_field = enc.get('y', {}).get('field')
    
    if not x_field or not y_field:
        return {'success': False, 'error': 'Cannot find x or y fields'}
    
    # 如果原规范没有 layer，转换为 layer 结构
    if 'layer' not in new_state:
        original_spec = copy.deepcopy(new_state)
        new_state['layer'] = [{
            'mark': original_spec.get('mark', 'point'),
            'encoding': original_spec.get('encoding', {})
        }]
        # 移除顶层的 mark 和 encoding
        if 'mark' in new_state:
            del new_state['mark']
        if 'encoding' in new_state:
            del new_state['encoding']
    
    # 添加回归线图层
    regression_transform = {
        'regression': y_field,
        'on': x_field
    }
    
    # 根据方法设置回归参数
    if method == "poly":
        regression_transform['method'] = 'poly'
        regression_transform['order'] = 3
    elif method == "quad":
        regression_transform['method'] = 'poly'
        regression_transform['order'] = 2
    elif method in ["log", "exp"]:
        regression_transform['method'] = method
    else:
        regression_transform['method'] = 'linear'
    
    new_state['layer'].append({
        'mark': {
            'type': 'line',
            'color': 'red',
            'strokeWidth': 2
        },
        'transform': [regression_transform],
        'encoding': {
            'x': {'field': x_field, 'type': 'quantitative'},
            'y': {'field': y_field, 'type': 'quantitative'}
        }
    })
    
    return {
        'success': True,
        'operation': 'show_regression',
        'vega_state': new_state,
        'message': f'Added {method} regression line'
    }



def _infer_field_type(data: List[Dict], field: str) -> str:
    """推断字段的 Vega-Lite 类型"""
    if not data:
        return 'nominal'
    
    for row in data:
        value = row.get(field)
        if value is not None:
            if isinstance(value, bool):
                return 'nominal'
            elif isinstance(value, (int, float)):
                return 'quantitative'
            elif isinstance(value, str):
                # 检查是否是日期格式
                if any(sep in value for sep in ['-', '/', ':']):
                    return 'temporal'
                return 'nominal'
    return 'nominal'


def _get_data_values(spec: Dict) -> List[Dict[str, Any]]:
    data_obj = spec.get("data")
    if isinstance(data_obj, dict) and isinstance(data_obj.get("values"), list):
        return data_obj["values"]
    values = DataStore.get_values()
    return values if isinstance(values, list) else []


def _get_filtered_data(state: Dict) -> List[Dict[str, Any]]:
    """获取应用 transform filter 后的数据，供 calculate_correlation / zoom / brush 等使用"""
    data = _get_spec_data(state) or _get_data_values(state)
    if not data:
        return []
    transforms = state.get("transform", [])
    if isinstance(state.get("layer"), list):
        for layer in state["layer"]:
            if isinstance(layer, dict) and "transform" in layer:
                transforms = transforms + layer.get("transform", [])
    return _apply_filters(data, transforms)


__all__ = [
    'identify_clusters',
    'calculate_correlation',
    'zoom_2d_region',
    'filter_categorical',
    'brush_region',
    'change_encoding',
    'show_regression',
]

for _fn_name in __all__:
    _fn = globals().get(_fn_name)
    if callable(_fn):
        globals()[_fn_name] = tool_output(_fn)
