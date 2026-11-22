/**
 * Adapted from Google Maps Platform 101 Codelab
 * Component to render a Google Maps Circle on a @vis.gl/react-google-maps Map
 */
import {
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef,
  type Ref,
} from "react";
import { GoogleMapsContext, latLngEquals } from "@vis.gl/react-google-maps";

type CircleEventProps = {
  onClick?: (e: google.maps.MapMouseEvent) => void;
  onDrag?: (e: google.maps.MapMouseEvent) => void;
  onDragStart?: (e: google.maps.MapMouseEvent) => void;
  onDragEnd?: (e: google.maps.MapMouseEvent) => void;
  onMouseOver?: (e: google.maps.MapMouseEvent) => void;
  onMouseOut?: (e: google.maps.MapMouseEvent) => void;
  onRadiusChanged?: (r: number) => void;
  onCenterChanged?: (p: google.maps.LatLng | null) => void;
};

export type CircleProps = google.maps.CircleOptions & CircleEventProps;
export type CircleRef = Ref<google.maps.Circle | null>;

function useCircle(props: CircleProps) {
  const {
    onClick,
    onDrag,
    onDragStart,
    onDragEnd,
    onMouseOver,
    onMouseOut,
    onRadiusChanged,
    onCenterChanged,
    radius,
    center,
    ...circleOptions
  } = props;

  const callbacks = useRef<Record<string, ((e: any) => void) | undefined>>({});
  callbacks.current = {
    onClick,
    onDrag,
    onDragStart,
    onDragEnd,
    onMouseOver,
    onMouseOut,
    onRadiusChanged,
    onCenterChanged,
  };

  const circle = useRef<google.maps.Circle | null>(null);
  if (!circle.current && typeof google !== "undefined" && google.maps && google.maps.Circle) {
    circle.current = new google.maps.Circle();
  }

  const map = useContext(GoogleMapsContext)?.map;

  useEffect(() => {
    if (!circle.current) return;
    circle.current.setOptions(circleOptions);
  }, [circleOptions]);

  useEffect(() => {
    if (!circle.current || !center) return;
    const currentCenter = circle.current.getCenter();
    if (!currentCenter || !latLngEquals(center, currentCenter)) {
      circle.current.setCenter(center);
    }
  }, [center]);

  useEffect(() => {
    if (!circle.current || radius === undefined || radius === null) return;
    if (radius !== circle.current.getRadius()) {
      circle.current.setRadius(radius);
    }
  }, [radius]);

  useEffect(() => {
    if (!circle.current || !map) return;
    circle.current.setMap(map);
    return () => {
      circle.current?.setMap(null);
    };
  }, [map]);

  useEffect(() => {
    if (!circle.current || typeof google === "undefined" || !google.maps) return;
    const c = circle.current;
    const gme = google.maps.event;

    const listeners = [
      gme.addListener(c, "click", (e: google.maps.MapMouseEvent) => callbacks.current.onClick?.(e)),
      gme.addListener(c, "radius_changed", () => callbacks.current.onRadiusChanged?.(c.getRadius())),
      gme.addListener(c, "center_changed", () => callbacks.current.onCenterChanged?.(c.getCenter())),
    ];

    return () => {
      listeners.forEach((l) => gme.removeListener(l));
    };
  }, []);

  return circle.current;
}

export const GoogleMapsCircle = forwardRef((props: CircleProps, ref: CircleRef) => {
  const circle = useCircle(props);
  useImperativeHandle(ref, () => circle);
  return null;
});
