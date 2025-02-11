import { baseUrl } from "./baseUrl";
import { useCallback, useEffect, useState } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { FrigateConfig } from "@/types/frigateConfig";
import { FrigateEvent, FrigateReview, ToggleableSetting } from "@/types/ws";
import { FrigateStats } from "@/types/stats";
import useSWR from "swr";
import { createContainer } from "react-tracked";

type Update = {
  topic: string;
  payload: any;
  retain: boolean;
};

type WsState = {
  [topic: string]: any;
};

type useValueReturn = [WsState, (update: Update) => void];

function useValue(): useValueReturn {
  // basic config
  const { data: config } = useSWR<FrigateConfig>("config", {
    revalidateOnFocus: false,
  });
  const wsUrl = `${baseUrl.replace(/^http/, "ws")}ws`;

  // main state
  const [wsState, setWsState] = useState<WsState>({});

  useEffect(() => {
    if (!config) {
      return;
    }

    const cameraStates: WsState = {};

    Object.keys(config.cameras).forEach((camera) => {
      const { name, record, detect, snapshots, audio } = config.cameras[camera];
      cameraStates[`${name}/recordings/state`] = record.enabled ? "ON" : "OFF";
      cameraStates[`${name}/detect/state`] = detect.enabled ? "ON" : "OFF";
      cameraStates[`${name}/snapshots/state`] = snapshots.enabled
        ? "ON"
        : "OFF";
      cameraStates[`${name}/audio/state`] = audio.enabled ? "ON" : "OFF";
    });

    setWsState({ ...wsState, ...cameraStates });
  }, [config]);

  // ws handler
  const { sendJsonMessage, readyState } = useWebSocket(wsUrl, {
    onMessage: (event) => {
      const data: Update = JSON.parse(event.data);

      if (data) {
        setWsState({ ...wsState, [data.topic]: data.payload });
      }
    },
    onOpen: () => {},
    shouldReconnect: () => true,
  });

  const setState = useCallback(
    (message: Update) => {
      if (readyState === ReadyState.OPEN) {
        sendJsonMessage({
          topic: message.topic,
          payload: message.payload,
          retain: message.retain,
        });
      }
    },
    [readyState, sendJsonMessage]
  );

  return [wsState, setState];
}

export const {
  Provider: WsProvider,
  useTrackedState: useWsState,
  useUpdate: useWsUpdate,
} = createContainer(useValue, { defaultState: {}, concurrentMode: true });

export function useWs(watchTopic: string, publishTopic: string) {
  const state = useWsState();
  const sendJsonMessage = useWsUpdate();

  const value = { payload: state[watchTopic] || null };

  const send = useCallback(
    (payload: any, retain = false) => {
      sendJsonMessage({
        topic: publishTopic || watchTopic,
        payload,
        retain,
      });
    },
    [sendJsonMessage, watchTopic, publishTopic]
  );

  return { value, send };
}

export function useDetectState(camera: string): {
  payload: ToggleableSetting;
  send: (payload: ToggleableSetting, retain?: boolean) => void;
} {
  const {
    value: { payload },
    send,
  } = useWs(`${camera}/detect/state`, `${camera}/detect/set`);
  return { payload, send };
}

export function useRecordingsState(camera: string): {
  payload: ToggleableSetting;
  send: (payload: ToggleableSetting, retain?: boolean) => void;
} {
  const {
    value: { payload },
    send,
  } = useWs(`${camera}/recordings/state`, `${camera}/recordings/set`);
  return { payload, send };
}

export function useSnapshotsState(camera: string): {
  payload: ToggleableSetting;
  send: (payload: ToggleableSetting, retain?: boolean) => void;
} {
  const {
    value: { payload },
    send,
  } = useWs(`${camera}/snapshots/state`, `${camera}/snapshots/set`);
  return { payload, send };
}

export function useAudioState(camera: string): {
  payload: ToggleableSetting;
  send: (payload: ToggleableSetting, retain?: boolean) => void;
} {
  const {
    value: { payload },
    send,
  } = useWs(`${camera}/audio/state`, `${camera}/audio/set`);
  return { payload, send };
}

export function usePtzCommand(camera: string): {
  payload: string;
  send: (payload: string, retain?: boolean) => void;
} {
  const {
    value: { payload },
    send,
  } = useWs(`${camera}/ptz`, `${camera}/ptz`);
  return { payload, send };
}

export function useRestart(): {
  payload: string;
  send: (payload: string, retain?: boolean) => void;
} {
  const {
    value: { payload },
    send,
  } = useWs("restart", "restart");
  return { payload, send };
}

export function useFrigateEvents(): { payload: FrigateEvent } {
  const {
    value: { payload },
  } = useWs("events", "");
  return { payload: JSON.parse(payload) };
}

export function useFrigateReviews(): { payload: FrigateReview } {
  const {
    value: { payload },
  } = useWs("reviews", "");
  return { payload: JSON.parse(payload) };
}

export function useFrigateStats(): { payload: FrigateStats } {
  const {
    value: { payload },
  } = useWs("stats", "");
  return { payload: JSON.parse(payload) };
}

export function useMotionActivity(camera: string): { payload: string } {
  const {
    value: { payload },
  } = useWs(`${camera}/motion`, "");
  return { payload };
}

export function useAudioActivity(camera: string): { payload: number } {
  const {
    value: { payload },
  } = useWs(`${camera}/audio/rms`, "");
  return { payload };
}
