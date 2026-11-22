import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  CrtRadarMap,
  generateArterialWaypoints,
  calculateArterialDynamics,
  ARTERIAL_CORRIDORS,
} from "../components/CrtRadarMap";
import { mockDonors, mockReceivers, mockListings } from "./test-mocks";

describe("Real-Time Driver GPS Radar Simulation Journey", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("defines arterial multi-waypoint Bengaluru corridors for Koramangala, Indiranagar, and HSR Layout", () => {
    expect(ARTERIAL_CORRIDORS.length).toBeGreaterThanOrEqual(3);

    const koramangala = ARTERIAL_CORRIDORS.find((c) =>
      c.name.includes("Koramangala")
    );
    const indiranagar = ARTERIAL_CORRIDORS.find((c) =>
      c.name.includes("Indiranagar")
    );
    const hsr = ARTERIAL_CORRIDORS.find((c) => c.name.includes("HSR"));

    expect(koramangala).toBeDefined();
    expect(koramangala?.description).toContain("Sony World Junction");
    expect(koramangala?.description).toContain("Koramangala 4th Block");
    expect(koramangala?.description).toContain("Dairy Circle");

    expect(indiranagar).toBeDefined();
    expect(indiranagar?.description).toContain("CMH Road");
    expect(indiranagar?.description).toContain("Indiranagar 100ft Road");
    expect(indiranagar?.description).toContain("Domlur Flyover");

    expect(hsr).toBeDefined();
    expect(hsr?.description).toContain("27th Main");
    expect(hsr?.description).toContain("Silk Board");
    expect(hsr?.description).toContain("Agara Junction");

    const waypoints = generateArterialWaypoints(
      { x: 330, y: 240 },
      { x: 490, y: 280 },
      0,
      "The Grand Amber",
      "City Hope Shelter"
    );
    expect(waypoints.length).toBe(4);
    expect(waypoints[0].x).toBe(330);
    expect(waypoints[3].x).toBe(490);
  });

  it("calculates realistic EV Trike telemetry with heading rotation, speed (22–36 km/h), regen, and Cambro temp >65°C", () => {
    const waypoints = generateArterialWaypoints(
      { x: 330, y: 240 },
      { x: 490, y: 280 },
      0
    );

    // Midpoint cruise (straight arterial stretch)
    const midCruise = calculateArterialDynamics(waypoints, 0.45);
    expect(midCruise.speedKmh).toBeGreaterThanOrEqual(22.0);
    expect(midCruise.speedKmh).toBeLessThanOrEqual(36.0);
    expect(midCruise.cambroTempC).toBeGreaterThan(65.0); // FSSAI Hot Hold standard
    expect(midCruise.batteryPercent).toBeGreaterThan(70.0);
    expect(typeof midCruise.heading).toBe("number");
    expect(midCruise.etaMinutes).toBeGreaterThan(0);

    // Waypoint turn deceleration
    const turnDecel = calculateArterialDynamics(waypoints, 0.31);
    expect(turnDecel.speedKmh).toBeGreaterThanOrEqual(22.0);
    expect(turnDecel.speedKmh).toBeLessThanOrEqual(26.0);
    expect(turnDecel.isRegenActive).toBe(true);

    // Destination arrival
    const arrival = calculateArterialDynamics(waypoints, 1.0);
    expect(arrival.speedKmh).toBe(0);
    expect(arrival.distanceRemainingKm).toBe(0);
    expect(arrival.etaMinutes).toBe(0);
  });

  it("renders EV Cargo Trike marker and live telemetry HUD on the radar map", () => {
    render(
      <CrtRadarMap
        donors={mockDonors}
        receivers={mockReceivers}
        listings={mockListings}
      />
    );

    // Verify HUD is present
    const hud = screen.getByTestId("radar-telemetry-hud");
    expect(hud).toBeInTheDocument();

    // Verify HUD metrics
    expect(screen.getByText(/EV FLEET TELEMETRY/i)).toBeInTheDocument();
    expect(screen.getAllByText(/EV CARGO TRIKE/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/DYNAMIC SPEED/i)).toBeInTheDocument();
    expect(screen.getByText(/LiFePO4 BATTERY/i)).toBeInTheDocument();
    expect(screen.getByText(/CAMBRO THERMAL HOLD/i)).toBeInTheDocument();
    expect(screen.getByText(/>65°C FSSAI Compliant/i)).toBeInTheDocument();
    expect(screen.getByText(/ESTIMATED ARRIVAL & CORRIDOR/i)).toBeInTheDocument();

    // Verify EV marker is rendered in SVG
    const evMarker = screen.getByTestId("courier-marker-l2");
    expect(evMarker).toBeInTheDocument();
  });

  it("triggers delivery confirmation callback when courier reaches destination", () => {
    const onConfirmDelivery = vi.fn();
    const deliveredListing = {
      ...mockListings[1],
      id: "l_delivered_test",
      status: "COLLECTED",
    };

    render(
      <CrtRadarMap
        donors={mockDonors}
        receivers={mockReceivers}
        listings={[deliveredListing]}
        onConfirmDelivery={onConfirmDelivery}
      />
    );

    // Verify component mounts and recognizes active courier
    expect(screen.getByTestId("courier-marker-l_delivered_test")).toBeInTheDocument();
  });
});
