(function() {
	var WIDGETVA_AGENT_BRIDGE_SOURCE_CONTENT = "widgetva-official-page-agent-content";
	var WIDGETVA_AGENT_BRIDGE_RESPONSE = "widgetva:official-page-agent-response";
	var WIDGETVA_AGENT_BRIDGE_RUNTIME = "widgetva:official-page-agent-runtime";
	//#endregion
	//#region extension/src/content/installOfficialPageAgentBridge.js
	var installed = false;
	function postResponse(root, payload) {
		root.postMessage({
			source: WIDGETVA_AGENT_BRIDGE_SOURCE_CONTENT,
			type: WIDGETVA_AGENT_BRIDGE_RESPONSE,
			...payload
		}, "*");
	}
	function installOfficialPageAgentBridge(root = window) {
		if (installed || !root) return;
		installed = true;
		root.addEventListener("message", (event) => {
			if (event.source !== root) return;
			const message = event.data;
			if (!message || message.source !== "widgetva-official-page-agent-page" || message.type !== "widgetva:official-page-agent-request") return;
			chrome.runtime.sendMessage({
				type: WIDGETVA_AGENT_BRIDGE_RUNTIME,
				method: message.method,
				params: message.params || null
			}, (response) => {
				if (chrome.runtime.lastError) {
					postResponse(root, {
						id: message.id,
						ok: false,
						error: {
							name: "Error",
							message: chrome.runtime.lastError.message || "WidgetVA extension bridge failed."
						}
					});
					return;
				}
				postResponse(root, {
					id: message.id,
					ok: response?.ok === true,
					...response?.ok === true ? { result: response?.result ?? null } : { error: response?.error || {
						name: "Error",
						message: "WidgetVA extension bridge failed."
					} }
				});
			});
		});
	}
	//#endregion
	//#region extension/src/content/vegaExamplesContentScript.js
	var PAGE_SCRIPT_ID = "widgetva-vega-examples-page-script";
	var PAGE_SCRIPT_PATH = "vegaExamplesPageScript.js";
	function injectPageScript() {
		if (document.getElementById(PAGE_SCRIPT_ID)) return;
		const pageScriptUrl = globalThis.chrome?.runtime?.getURL?.(PAGE_SCRIPT_PATH);
		if (!pageScriptUrl) {
			console.error("[WidgetVA] Unable to resolve the Vega examples page-script URL from the extension runtime.");
			return;
		}
		const script = document.createElement("script");
		script.id = PAGE_SCRIPT_ID;
		script.src = pageScriptUrl;
		script.async = false;
		script.addEventListener("load", () => {
			script.remove();
		});
		const target = document.documentElement || document.head;
		if (!target) {
			console.error("[WidgetVA] Unable to inject the Vega examples page script because no root element is available.");
			return;
		}
		target.prepend(script);
	}
	installOfficialPageAgentBridge(window);
	injectPageScript();
	//#endregion
})();
