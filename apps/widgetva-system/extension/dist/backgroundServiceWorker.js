//#endregion
//#region extension/src/background/openRouterAgentService.js
var WIDGETVA_AGENT_CONFIG_KEY = "widgetvaOfficialPageAgentConfig";
function clone(value) {
	return value == null ? value : JSON.parse(JSON.stringify(value));
}
function trimString(value) {
	return typeof value === "string" ? value.trim() : "";
}
function normalizeStoredAgentConfig(config = {}) {
	const apiKey = trimString(config?.apiKey);
	const model = trimString(config?.model) || "deepseek/deepseek-v4-flash";
	const siteUrl = trimString(config?.siteUrl);
	const appName = trimString(config?.appName) || "WidgetVA Official Page Integration";
	return {
		...apiKey ? { apiKey } : {},
		model,
		...siteUrl ? { siteUrl } : {},
		...appName ? { appName } : {}
	};
}
async function readStoredAgentConfig(storage) {
	return normalizeStoredAgentConfig((await storage.get("widgetvaOfficialPageAgentConfig"))?.["widgetvaOfficialPageAgentConfig"] || {});
}
async function writeStoredAgentConfig(storage, config = {}) {
	const next = normalizeStoredAgentConfig(config);
	await storage.set({ [WIDGETVA_AGENT_CONFIG_KEY]: next });
	return {
		apiKeyConfigured: Boolean(next.apiKey),
		model: next.model,
		siteUrl: next.siteUrl || null,
		appName: next.appName || null
	};
}
function buildOpenRouterChatRequest({ config = {}, payload = {} } = {}) {
	const apiKey = trimString(config?.apiKey);
	if (!apiKey) throw new Error("WidgetVA agent is not configured with an OpenRouter API key.");
	return {
		url: "https://openrouter.ai/api/v1/chat/completions",
		init: {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${apiKey}`,
				...config?.siteUrl ? { "HTTP-Referer": config.siteUrl } : {},
				...config?.appName ? { "X-Title": config.appName } : {}
			},
			body: JSON.stringify({
				model: trimString(payload?.model) || config.model || "deepseek/deepseek-v4-flash",
				temperature: Number.isFinite(payload?.temperature) ? Number(payload.temperature) : .2,
				messages: Array.isArray(payload?.messages) ? clone(payload.messages) : []
			})
		}
	};
}
async function executeOpenRouterChat({ storage, fetchImpl, payload = {} } = {}) {
	const config = await readStoredAgentConfig(storage);
	const request = buildOpenRouterChatRequest({
		config,
		payload
	});
	const response = await fetchImpl(request.url, request.init);
	const json = await response.json();
	if (!response.ok) {
		const message = json?.error?.message || json?.message || "OpenRouter request failed.";
		throw new Error(message);
	}
	return {
		model: trimString(payload?.model) || config.model || "deepseek/deepseek-v4-flash",
		raw: json,
		content: json?.choices?.[0]?.message?.content || ""
	};
}
function createOpenRouterAgentService({ storage, fetchImpl } = {}) {
	if (!storage || typeof storage.get !== "function" || typeof storage.set !== "function") throw new Error("createOpenRouterAgentService requires a storage facade with get/set.");
	if (typeof fetchImpl !== "function") throw new Error("createOpenRouterAgentService requires fetchImpl().");
	return {
		async configure(params = {}) {
			return writeStoredAgentConfig(storage, params);
		},
		async readConfig() {
			const config = await readStoredAgentConfig(storage);
			return {
				apiKeyConfigured: Boolean(config.apiKey),
				model: config.model || "deepseek/deepseek-v4-flash",
				siteUrl: config.siteUrl || null,
				appName: config.appName || null
			};
		},
		async chat(params = {}) {
			return executeOpenRouterChat({
				storage,
				fetchImpl,
				payload: params
			});
		}
	};
}
//#endregion
//#region extension/src/background/serviceWorker.js
var agentService = createOpenRouterAgentService({
	storage: chrome.storage.local,
	fetchImpl: globalThis.fetch.bind(globalThis)
});
function summarizeError(error) {
	return {
		name: error?.name || "Error",
		message: error?.message || String(error || "Unknown WidgetVA agent bridge error.")
	};
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (!message || message.type !== "widgetva:official-page-agent-runtime") return false;
	const method = message.method;
	if (method !== "configure" && method !== "readConfig" && method !== "chat") {
		sendResponse({
			ok: false,
			error: {
				name: "Error",
				message: `Unsupported WidgetVA agent runtime method: ${String(method)}.`
			}
		});
		return false;
	}
	Promise.resolve().then(async () => {
		if (method === "configure") return agentService.configure(message.params || {});
		if (method === "readConfig") return agentService.readConfig();
		return agentService.chat(message.params || {});
	}).then((result) => {
		sendResponse({
			ok: true,
			result
		});
	}).catch((error) => {
		sendResponse({
			ok: false,
			error: summarizeError(error)
		});
	});
	return true;
});
//#endregion
