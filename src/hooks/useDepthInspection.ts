import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { strings } from '@/i18n';
import { normalizeApiError, rijkswaterstaatService } from '@/services';
import type { Coordinates, DepthSample, DepthSampleSource } from '@/types';
import { DEPTH_DETAIL_ZOOM, logApiError } from '@/utils';

export function useDepthInspection(enabled = true, networkEpoch = 0) {
  const inspectionControllerRef = useRef<AbortController | null>(null);
  const enabledRef = useRef(enabled);
  const networkEpochRef = useRef(networkEpoch);
  const [selectedSample, setSelectedSample] = useState<DepthSample | null>(
    null,
  );
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectionError, setInspectionError] = useState<string | null>(null);
  const [inspectionEpoch, setInspectionEpoch] = useState(networkEpoch);
  const inspectDepth = async (coordinates: Coordinates, zoom: number) => {
    if (!enabledRef.current) {
      return;
    }

    const requestEpoch = networkEpochRef.current;
    inspectionControllerRef.current?.abort();
    const controller = new AbortController();
    const source: DepthSampleSource =
      zoom >= DEPTH_DETAIL_ZOOM ? 'inland-1m' : 'coastal-20m';
    inspectionControllerRef.current = controller;
    setInspectionEpoch(requestEpoch);
    setSelectedSample(null);
    setInspectionError(null);
    setIsInspecting(true);

    try {
      const sample = await rijkswaterstaatService.getDepthAt(
        coordinates,
        source,
        controller.signal,
      );

      if (!controller.signal.aborted) {
        setSelectedSample(sample);
        setInspectionError(sample ? null : strings.depthPointUnavailable);
      }
    } catch (requestError: unknown) {
      const apiError = normalizeApiError(requestError, {
        operation: 'inspectDepth',
        provider: 'rijkswaterstaat',
      });

      if (
        apiError.kind !== 'canceled' &&
        !controller.signal.aborted &&
        inspectionControllerRef.current === controller
      ) {
        logApiError(apiError);
        setInspectionError(strings.depthPointUnavailable);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsInspecting(false);
      }
    }
  };

  const clearDepthInspection = () => {
    inspectionControllerRef.current?.abort();
    setSelectedSample(null);
    setInspectionError(null);
    setIsInspecting(false);
  };

  useEffect(
    () => () => {
      inspectionControllerRef.current?.abort();
    },
    [],
  );

  useLayoutEffect(() => {
    inspectionControllerRef.current?.abort();
    enabledRef.current = enabled;
    networkEpochRef.current = networkEpoch;
  }, [enabled, networkEpoch]);

  const inspectionIsCurrent = enabled && inspectionEpoch === networkEpoch;

  return {
    selectedSample: inspectionIsCurrent ? selectedSample : null,
    isInspecting: inspectionIsCurrent && isInspecting,
    inspectionError: inspectionIsCurrent ? inspectionError : null,
    inspectDepth,
    clearDepthInspection,
  };
}
