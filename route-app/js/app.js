import { buildRouteIndex } from "./geo.js";
import { FleetMap } from "./map.js";
import { FleetSimulator } from "./simulation.js";

const AZURE_MAPS_KEY = "YOUR_AZURE_MAPS_SUBSCRIPTION_KEY";
const elements = {};
const state = { snapshots: [], selectedVehicleId: null, simulator: null, fleetMap: null };

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
	cacheElements();
	if (!/^https?:$/.test(window.location.protocol)) {
		showBlocker("HTTPサーバーが必要です", "データファイルを読み込むため、リポジトリのルートでHTTPサーバーを起動してください。", "python -m http.server 8000");
		return;
	}
	if (!hasConfiguredKey()) {
		showBlocker("Azure Mapsキーを設定してください", "route-app/js/app.js の AZURE_MAPS_KEY をAzure Mapsのサブスクリプションキーへ置き換えてください。", "const AZURE_MAPS_KEY = \"...\";");
		return;
	}

	try {
		const [routeData, vehicleData] = await Promise.all([
			fetchJson("data/routes.geojson"),
			fetchJson("data/vehicles.json")
		]);
		const { routes, routesById, routeIndexes, vehicles } = prepareData(routeData, vehicleData);
		state.selectedVehicleId = vehicles[0].id;
		state.fleetMap = new FleetMap(AZURE_MAPS_KEY, selectVehicle);
		await state.fleetMap.initialize(routes, vehicles);
		state.simulator = new FleetSimulator(vehicles, routesById, routeIndexes, renderSnapshot);
		bindEvents();
		setControlsDisabled(false);
		state.simulator.start();
		setStatus("5台の配送トラッキングを開始しました。", false);
	} catch (error) {
		console.error("Fleet tracking initialization failed", error);
		showBlocker("配送データを読み込めません", error.message, "route-app/README.md を確認してください");
	}
}

function prepareData(routeData, vehicleData) {
	if (routeData?.type !== "FeatureCollection" || !Array.isArray(routeData.features)) throw new Error("routes.geojsonの形式が正しくありません。");
	if (!Array.isArray(vehicleData?.vehicles) || vehicleData.vehicles.length === 0) throw new Error("vehicles.jsonに車両がありません。");

	const routeIndexes = new Map();
	const routesById = new Map();
	const routes = routeData.features.map((route) => {
		const routeId = route.properties?.routeId;
		const coordinates = route.geometry?.coordinates;
		if (!routeId || route.geometry?.type !== "LineString") throw new Error("すべてのルートにrouteIdとLineStringが必要です。");
		if (routesById.has(routeId)) throw new Error(`routeIdが重複しています: ${routeId}`);
		const routeIndex = buildRouteIndex(coordinates);
		const destinations = route.properties.destinations.map((destination) => {
			const coordinateIndex = Number(destination.coordinateIndex);
			if (!Number.isInteger(coordinateIndex) || coordinateIndex < 1 || coordinateIndex >= coordinates.length) {
				throw new Error(`${routeId}の配送先座標インデックスが不正です。`);
			}
			return {
				...destination,
				position: coordinates[coordinateIndex],
				distanceMeters: routeIndex.cumulativeDistances[coordinateIndex]
			};
		});
		const normalizedRoute = { ...route, properties: { ...route.properties, destinations } };
		routeIndexes.set(routeId, routeIndex);
		routesById.set(routeId, normalizedRoute);
		return normalizedRoute;
	});

	const vehicles = vehicleData.vehicles.map((vehicle) => {
		if (!vehicle.id || !routesById.has(vehicle.routeId) || !Array.isArray(vehicle.cargo)) {
			throw new Error("車両ID、routeId、cargoのいずれかが不正です。");
		}
		if (!(Number(vehicle.speedMetersPerSecond) > 0)) throw new Error(`${vehicle.id}の速度は0より大きい値が必要です。`);
		return { ...vehicle, progressMeters: Math.max(0, Number(vehicle.progressMeters) || 0) };
	});
	return { routes, routesById, routeIndexes, vehicles };
}

function renderSnapshot(snapshots, simulatorState) {
	state.snapshots = snapshots;
	state.fleetMap.updateVehicles(snapshots, state.selectedVehicleId);
	elements.vehicleList.replaceChildren(...snapshots.map(createVehicleCard));
	const drivingCount = snapshots.filter((vehicle) => vehicle.status === "driving").length;
	const completedCount = snapshots.filter((vehicle) => vehicle.status === "completed").length;
	elements.fleetSummary.textContent = `${drivingCount}台走行中 / ${completedCount}台完了`;
	elements.toggleButton.textContent = simulatorState.paused ? "再生" : "一時停止";
}

function createVehicleCard(vehicle) {
	const card = document.createElement("button");
	card.type = "button";
	card.className = "vehicle-card";
	card.classList.toggle("selected", vehicle.id === state.selectedVehicleId);
	card.style.setProperty("--vehicle-color", vehicle.color);
	card.addEventListener("click", () => selectVehicle(vehicle.id));

	const header = document.createElement("span");
	header.className = "vehicle-header";
	header.append(
		createText("strong", vehicle.name),
		createText("span", statusLabel(vehicle.status), `status-badge ${vehicle.status}`)
	);
	const identity = createText("span", `${vehicle.id} / ${vehicle.routeId}`, "vehicle-identity");
	const eta = document.createElement("span");
	eta.className = "eta-grid";
	eta.append(
		createMetric("次の目的地", vehicle.nextDestination.name),
		createMetric("到着まで", vehicle.status === "completed" ? "到着済み" : `あと ${vehicle.minutesToNext}分`),
		createMetric("最終到着予想", vehicle.status === "completed" ? "配送完了" : formatTime(vehicle.finalArrivalTime))
	);
	const cargo = document.createElement("span");
	cargo.className = "cargo-list";
	cargo.append(createText("span", "配送中の商品", "metric-label"));
	vehicle.cargo.forEach((item) => cargo.append(createText("span", `${item.sku}  ${item.name} × ${item.quantity}`)));
	card.append(header, identity, eta, cargo);
	return card;
}

function createMetric(label, value) {
	const metric = document.createElement("span");
	metric.className = "metric";
	metric.append(createText("span", label, "metric-label"), createText("strong", value));
	return metric;
}

function createText(tagName, text, className = "") {
	const element = document.createElement(tagName);
	element.className = className;
	element.textContent = text;
	return element;
}

function selectVehicle(vehicleId) {
	state.selectedVehicleId = vehicleId;
	renderSnapshot(state.snapshots, { paused: state.simulator.paused });
	const vehicle = state.snapshots.find((item) => item.id === vehicleId);
	if (vehicle) state.fleetMap.focusVehicle(vehicle);
}

function bindEvents() {
	elements.toggleButton.addEventListener("click", () => {
		if (state.simulator.paused) state.simulator.start();
		else state.simulator.pause();
	});
	elements.resetButton.addEventListener("click", () => {
		state.simulator.reset();
		setStatus("全車両を初期位置へ戻しました。", false);
	});
	elements.showAllButton.addEventListener("click", () => state.fleetMap.showAll());
	window.addEventListener("beforeunload", () => state.simulator.destroy());
}

async function fetchJson(path) {
	const response = await fetch(path);
	if (!response.ok) throw new Error(`${path}: ${response.status} ${response.statusText}`);
	return response.json();
}

function cacheElements() {
	["fleet-summary", "show-all-button", "toggle-button", "reset-button", "vehicle-list", "status", "blocker", "blocker-title", "blocker-detail", "blocker-command"]
		.forEach((id) => { elements[toCamelCase(id)] = document.getElementById(id); });
}

function setControlsDisabled(disabled) {
	[elements.showAllButton, elements.toggleButton, elements.resetButton].forEach((button) => { button.disabled = disabled; });
}

function setStatus(message, error) {
	elements.status.textContent = message;
	elements.status.classList.toggle("error", error);
	elements.status.hidden = false;
	window.clearTimeout(setStatus.timer);
	setStatus.timer = window.setTimeout(() => { elements.status.hidden = true; }, 5000);
}

function showBlocker(title, detail, command) {
	elements.blockerTitle.textContent = title;
	elements.blockerDetail.textContent = detail;
	elements.blockerCommand.textContent = command;
	elements.blocker.hidden = false;
}

function statusLabel(status) {
	return { driving: "走行中", paused: "一時停止", completed: "配送完了" }[status];
}

function formatTime(date) {
	return new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" }).format(date);
}

function hasConfiguredKey() {
	return AZURE_MAPS_KEY && !AZURE_MAPS_KEY.startsWith("YOUR_");
}

function toCamelCase(value) {
	return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}