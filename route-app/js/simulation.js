import { createVehicleSnapshot } from "./geo.js";

export class FleetSimulator {
	constructor(vehicles, routesById, routeIndexes, onUpdate, options = {}) {
		this.initialVehicles = vehicles.map((vehicle) => ({ ...vehicle }));
		this.vehicles = vehicles.map((vehicle) => ({ ...vehicle }));
		this.routesById = routesById;
		this.routeIndexes = routeIndexes;
		this.onUpdate = onUpdate;
		this.intervalMilliseconds = options.intervalMilliseconds || 10000;
		this.timer = null;
		this.paused = true;
	}

	start() {
		if (this.timer) return;
		this.paused = false;
		this.emit();
		this.timer = window.setInterval(() => this.tick(), this.intervalMilliseconds);
	}

	pause() {
		if (this.timer) window.clearInterval(this.timer);
		this.timer = null;
		this.paused = true;
		this.emit();
	}

	reset() {
		this.pause();
		this.vehicles = this.initialVehicles.map((vehicle) => ({ ...vehicle }));
		this.emit();
	}

	tick() {
		this.vehicles = this.vehicles.map((vehicle) => {
			const routeIndex = this.routeIndexes.get(vehicle.routeId);
			const stepMeters = vehicle.speedMetersPerSecond * this.intervalMilliseconds / 1000;
			return {
				...vehicle,
				progressMeters: Math.min(vehicle.progressMeters + stepMeters, routeIndex.totalDistance)
			};
		});
		this.emit();
		if (this.vehicles.every((vehicle) => {
			const routeIndex = this.routeIndexes.get(vehicle.routeId);
			return vehicle.progressMeters >= routeIndex.totalDistance;
		})) this.pause();
	}

	emit() {
		const now = new Date();
		const snapshots = this.vehicles.map((vehicle) => createVehicleSnapshot(
			vehicle,
			this.routesById.get(vehicle.routeId),
			this.routeIndexes.get(vehicle.routeId),
			this.paused,
			now
		));
		this.onUpdate(snapshots, { paused: this.paused });
	}

	destroy() {
		if (this.timer) window.clearInterval(this.timer);
		this.timer = null;
	}
}