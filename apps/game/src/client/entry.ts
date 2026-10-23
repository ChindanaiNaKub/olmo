import { Runtime } from "foldkit";

import { view } from "../features/game/view.js";
import { GameMessage } from "./game/message.js";
import { ModelSchema, init } from "./game/model.js";
import { managedResources } from "./game/socket.js";
import { subscriptions } from "./game/subscription.js";
import { update } from "./game/update.js";

const application = Runtime.makeApplication({
  Model: ModelSchema,
  container: document.querySelector("#root"),
  devTools: { Message: GameMessage },
  init,
  managedResources,
  subscriptions,
  update,
  view,
});

Runtime.run(application);
