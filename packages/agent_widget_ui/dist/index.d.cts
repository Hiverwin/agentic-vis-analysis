import * as react_jsx_runtime from 'react/jsx-runtime';

type AnalyzeRequest = {
    query: string;
    vega_spec: Record<string, unknown>;
    model_name?: string;
    input_mode?: string;
    max_iterations?: number;
    chart_type?: string;
    session_id?: string;
    metadata?: Record<string, unknown>;
    request_id?: string;
};
type AnalyzeResponse = {
    request_id: string;
    query: string;
    success: boolean;
    answer: string;
    tool_calls: Array<Record<string, unknown>>;
    final_observation: Record<string, unknown>;
    chart_type: string;
    mode: string;
    error?: string;
    stop_reason?: string;
    metadata?: Record<string, unknown>;
};
type AgentWidgetTheme = {
    borderColor?: string;
    panelBackground?: string;
    textColor?: string;
    accentColor?: string;
};

type AgentWidgetProps = {
    apiBaseUrl: string;
    vegaSpec: Record<string, unknown>;
    modelName?: string;
    defaultQuery?: string;
    inputMode?: string;
    maxIterations?: number;
    chartType?: string;
    metadata?: Record<string, unknown>;
    getAuthToken?: () => string | undefined | Promise<string | undefined>;
    theme?: AgentWidgetTheme;
    onResult?: (result: AnalyzeResponse) => void;
    onError?: (error: string) => void;
    className?: string;
};
declare function AgentWidget(props: AgentWidgetProps): react_jsx_runtime.JSX.Element;

type UseAgentAnalysisOptions = {
    apiBaseUrl: string;
    endpoint?: string;
    getAuthToken?: () => string | undefined | Promise<string | undefined>;
};
declare function useAgentAnalysis(options: UseAgentAnalysisOptions): {
    loading: boolean;
    result: AnalyzeResponse | null;
    error: string;
    analyze: (payload: AnalyzeRequest) => Promise<AnalyzeResponse & {
        detail?: string;
    }>;
    clearResult: () => void;
};

export { AgentWidget, type AgentWidgetProps, type AgentWidgetTheme, type AnalyzeRequest, type AnalyzeResponse, useAgentAnalysis };
