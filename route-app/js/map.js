export class FleetMap {
	constructor(subscriptionKey, onVehicleSelect) {
		this.onVehicleSelect = onVehicleSelect;
		this.map = new atlas.Map("map", {
			center: [139.7671, 35.6812],
			zoom: 11,
			language: "ja-JP",
			view: "Auto",
			style: "road",
			authOptions: { authType: "subscriptionKey", subscriptionKey }
		});
		this.weatherLayer = null;
	}

	initialize(routes, vehicles) {
		return new Promise((resolve) => {
			this.map.events.add("ready", async () => {
				this.routeSource = new atlas.source.DataSource("delivery-routes");
				this.destinationSource = new atlas.source.DataSource("delivery-destinations");
				this.vehicleSource = new atlas.source.DataSource("delivery-vehicles");
				this.map.sources.add([this.routeSource, this.destinationSource, this.vehicleSource]);

				this.routeSource.add(routes.map((route) => new atlas.data.Feature(
					new atlas.data.LineString(route.geometry.coordinates),
					{ routeId: route.properties.routeId, color: route.properties.color }
				)));
				this.destinationSource.add(routes.flatMap((route) => route.properties.destinations.map((destination) => (
					new atlas.data.Feature(new atlas.data.Point(destination.position), {
						label: String(destination.order),
						name: destination.name,
						color: route.properties.color
					})
				))));

				await Promise.all(vehicles.map((vehicle) => this.map.imageSprite.createFromTemplate(
					`car-${vehicle.id}`,
					"car",
					vehicle.color,
					"#ffffff",
					1.4
				)));

				this.weatherLayer = new atlas.layer.TileLayer({
					tileUrl: "https://{azMapsDomain}/map/tile?api-version=2024-04-01&tilesetId=microsoft.weather.radar.main&zoom={z}&x={x}&y={y}",
					opacity: 0.7,
					visible: false
				}, "weather-radar-layer");

				this.map.layers.add([
					new atlas.layer.LineLayer(this.routeSource, "route-outline", {
						strokeColor: "#ffffff",
						strokeWidth: 13,
						strokeOpacity: 0.9,
						lineJoin: "round",
						lineCap: "round"
					}),
					new atlas.layer.LineLayer(this.routeSource, "route-lines", {
						strokeColor: ["get", "color"],
						strokeWidth: 7,
						strokeOpacity: 0.95,
						lineJoin: "round",
						lineCap: "round"
					}),
					new atlas.layer.SymbolLayer(this.destinationSource, "destination-points", {
						iconOptions: { image: "pin-round-darkblue", allowOverlap: true },
						textOptions: { textField: ["get", "label"], color: "#ffffff", offset: [0, -0.05], allowOverlap: true }
					}),
					this.vehicleLayer = new atlas.layer.SymbolLayer(this.vehicleSource, "vehicle-points", {
						iconOptions: {
							image: ["get", "iconId"],
							rotation: ["get", "heading"],
							allowOverlap: true,
							ignorePlacement: true
						},
						textOptions: {
							textField: ["get", "vehicleId"],
							offset: [0, 1.7],
							color: "#17201d",
							haloColor: "#ffffff",
							haloWidth: 2,
							allowOverlap: true
						}
					}),
					this.weatherLayer
				]);

				this.map.controls.add([new atlas.control.ZoomControl(), new atlas.control.CompassControl()], { position: "top-right" });
				this.map.events.add("click", this.vehicleLayer, (event) => {
					const vehicleId = event.shapes?.[0]?.getProperties()?.vehicleId;
					if (vehicleId) this.onVehicleSelect(vehicleId);
				});
				this.routes = routes;
				this.showAll();
				resolve();
			});
		});
	}

	updateVehicles(vehicles, selectedVehicleId) {
		if (!this.vehicleSource) return;
		this.vehicleSource.clear();
		this.vehicleSource.add(vehicles.map((vehicle) => new atlas.data.Feature(
			new atlas.data.Point(vehicle.position),
			{
				vehicleId: vehicle.id,
				heading: vehicle.heading,
				iconId: `car-${vehicle.id}`,
				selected: vehicle.id === selectedVehicleId
			}
		)));
	}

	focusVehicle(vehicle) {
		this.map.setCamera({ center: vehicle.position, zoom: 14, duration: 600 });
	}

	setTrafficLayerEnabled(enabled) {
		this.map?.setTraffic({ flow: enabled ? "relative" : "none", incidents: enabled });
	}

	setWeatherLayerEnabled(enabled) {
		if (!this.weatherLayer) return;
		this.weatherLayer.setOptions({ visible: enabled, opacity: 0.7 });
	}

	showAll() {
		const positions = this.routes.flatMap((route) => route.geometry.coordinates);
		this.map.setCamera({ bounds: atlas.data.BoundingBox.fromPositions(positions), padding: 70, duration: 600 });
	}
}