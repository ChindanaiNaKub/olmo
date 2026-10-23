import {
  createEffectActor,
  createEffectLogic,
  setupEffect,
} from "@xstate/effect";
import { Effect } from "effect";

const sendMail = createEffectLogic(Effect.log("confirmation sent"));

export const signup = setupEffect({ actors: { sendMail } }).createMachine({
  initial: "sending",
  states: {
    failed: { type: "final" },
    sending: {
      invoke: {
        onDone: { target: "sent" },
        onError: { target: "failed" },
        src: "sendMail",
      },
    },
    sent: { type: "final" },
  },
});

export const startSignup = createEffectActor(signup);
