import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import toast from "react-hot-toast";

import { useMission } from "../../context/MissionContext.jsx";
import { API_BASE_URL } from "../../api/inferenceApi.js";
import { toFriendlyMissionError } from "../../lib/errors.js";
import DetectModal from "../modals/DetectModal.jsx";
import ForecastModal from "../modals/ForecastModal.jsx";
import MissionLoading from "../loading/MissionLoading.jsx";
import FloatingActions from "./FloatingActions.jsx";
import MapView from "./MapView.jsx";
import SearchBar from "./SearchBar.jsx";
import SystemStatus from "./SystemStatus.jsx";

export default function MapScreen() {
  const {
    roi,
    setRoi,
    setLocationLabel,
    loading,
    workflow,
    modal,
    setModal,
    error,
    setError,
  } = useMission();

  const [placeRoiAt, setPlaceRoiAt] = useState(null);
  const [backendOnline, setBackendOnline] = useState(false);

  useEffect(() => {
    const friendly = toFriendlyMissionError({ message: error });
    if (friendly) {
      toast.error(friendly);
      setError(null);
    }
  }, [error, setError]);

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE_URL}/`)
      .then((r) => {
        if (!cancelled) setBackendOnline(r.ok);
      })
      .catch(() => {
        if (!cancelled) setBackendOnline(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePlaceSelect = useCallback(
    (place) => {
      setLocationLabel(place.label);
      setPlaceRoiAt({
        key: Date.now(),
        latitude: place.latitude,
        longitude: place.longitude,
        zoom: place.zoom ?? 11.5,
      });
      toast.success("ROI locked to search location", { icon: "◎" });
    },
    [setLocationLabel],
  );

  const handleResetRoi = () => {
    setRoi(null);
    toast("ROI cleared — click the map to select a new region", { icon: "↺" });
  };

  return (
    <motion.section
      className="map-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <MapView
        roi={roi}
        onRoiChange={setRoi}
        placeRoiAt={placeRoiAt}
      />

      <div className="map-hint glass-panel">
        Click anywhere on the map to place a fixed intelligence ROI
      </div>

      <div className="map-overlay-ui">
        <SearchBar onSelectPlace={handlePlaceSelect} />
        <FloatingActions
          hasRoi={Boolean(roi)}
          onDetect={() => setModal("detect")}
          onForecast={() => setModal("forecast")}
          onReset={handleResetRoi}
        />
        <SystemStatus roi={roi} backendOnline={backendOnline} />
      </div>

      <AnimatePresence>
        {loading && <MissionLoading workflow={workflow} />}
      </AnimatePresence>

      <AnimatePresence>
        {modal === "detect" && <DetectModal />}
        {modal === "forecast" && <ForecastModal />}
      </AnimatePresence>
    </motion.section>
  );
}
