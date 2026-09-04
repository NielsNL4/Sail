import { useEffect, useRef, useState } from 'react';

import { strings } from '@/i18n';
import { normalizeApiError, rijkswaterstaatService } from '@/services';
import type { Coordinates, DepthSample, DepthSampleSource } from '@/types';
import { DEPTH_DETAIL_ZOOM, logApiError } from '@/utils';

export function useDepthInspection() {
  const inspectionControllerRef = useRef<AbortController | null>(null);
  const [selectedSample, setSelectedSample] = useState<DepthSample | null>(
    null,
  );
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectionError, setInspectionError] = useState<string | null>(null);
  const inspectDepth = async (coordinates: Coordinates, zoom: number) => {
    inspectionControllerRef.current?.abort();
    const controller = new AbortController();
    const source: DepthSampleSource =
      zoom >= DEPTH_DETAIL_ZOOM ? 'inland-1m' : 'coastal-20m';
    inspectionControllerRef.current = controller;
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

  return {
    selectedSample,
    isInspecting,
    inspectionError,
    inspectDepth,
    clearDepthInspection,
  };
}
