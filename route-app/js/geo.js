const EARTH_RADIUS_METERS = 6371008.8;

export function distanceMeters(start, end) {
	const startLatitude = toRadians(start[1]);
	const endLatitude = toRadians(end[1]);
	const latitudeDelta = endLatitude - startLatitude;
	const longitudeDelta = toRadians(end[0] - start[0]);
	const haversine = Math.sin(latitudeDelta / 2) ** 2
		+ Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
	return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(haversine));
}

export function buildRouteIndex(coordinates) {
	if (!Array.isArray(coordinates) || coordinates.length < 2) {
		throw new Error("ルートには2点以上の座標が必要です。");
	}

	const cumulativeDistances = [0];
	for (let index = 1; index < coordinates.length; index += 1) {
		const segmentDistance = distanceMeters(coordinates[index - 1], coordinates[index]);
		cumulativeDistances.push(cumulativeDistances[index - 1] + segmentDistance);
	}

	return {
		coordinates,
		cumulativeDistances,
		totalDistance: cumulativeDistances.at(-1)
	};
}

export function pointAlongRoute(routeIndex, requestedDistance) {
	const distance = clamp(requestedDistance, 0, routeIndex.totalDistance);
	let segmentIndex = routeIndex.cumulativeDistances.findIndex((value) => value >= distance);
	if (segmentIndex <= 0) segmentIndex = 1;

	const startDistance = routeIndex.cumulativeDistances[segmentIndex - 1];
	const endDistance = routeIndex.cumulativeDistances[segmentIndex];
	const segmentDistance = endDistance - startDistance;
	const ratio = segmentDistance === 0 ? 0 : (distance - startDistance) / segmentDistance;
	const start = routeIndex.coordinates[segmentIndex - 1];
	const end = routeIndex.coordinates[segmentIndex];

	return {
		position: [
			start[0] + (end[0] - start[0]) * ratio,
			start[1] + (end[1] - start[1]) * ratio
		],
		heading: bearingDegrees(start, end),
		distance
	};
}

export function createVehicleSnapshot(vehicle, route, routeIndex, paused, now = new Date()) {
	const routePoint = pointAlongRoute(routeIndex, vehicle.progressMeters);
	const destinations = route.properties.destinations;
	const nextDestination = destinations.find((destination) => destination.distanceMeters > routePoint.distance);
	const remainingMeters = Math.max(0, routeIndex.totalDistance - routePoint.distance);
	const completed = remainingMeters === 0;
	const speedMetersPerSecond = vehicle.speedMetersPerSecond;
	const finalSeconds = speedMetersPerSecond > 0 ? remainingMeters / speedMetersPerSecond : 0;

	return {
		...vehicle,
		position: routePoint.position,
		heading: routePoint.heading,
		progressMeters: routePoint.distance,
		totalDistanceMeters: routeIndex.totalDistance,
		nextDestination: nextDestination || destinations.at(-1),
		minutesToNext: nextDestination
			? Math.ceil((nextDestination.distanceMeters - routePoint.distance) / speedMetersPerSecond / 60)
			: 0,
		finalArrivalTime: new Date(now.getTime() + finalSeconds * 1000),
		status: completed ? "completed" : paused ? "paused" : "driving"
	};
}

function bearingDegrees(start, end) {
	const startLatitude = toRadians(start[1]);
	const endLatitude = toRadians(end[1]);
	const longitudeDelta = toRadians(end[0] - start[0]);
	const y = Math.sin(longitudeDelta) * Math.cos(endLatitude);
	const x = Math.cos(startLatitude) * Math.sin(endLatitude)
		- Math.sin(startLatitude) * Math.cos(endLatitude) * Math.cos(longitudeDelta);
	return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

function clamp(value, minimum, maximum) {
	return Math.min(Math.max(Number(value) || 0, minimum), maximum);
}

function toRadians(value) {
	return value * Math.PI / 180;
}

function toDegrees(value) {
	return value * 180 / Math.PI;
}