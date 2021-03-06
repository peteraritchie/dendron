import { DVault, getStage } from "@dendronhq/common-all";
import {
  assignJSONWithComment,
  readJSONWithComments,
  writeJSONWithComments,
} from "@dendronhq/common-server";
import { WorkspaceService } from "@dendronhq/engine-server";
import _ from "lodash";
import { commands, window } from "vscode";
import { DENDRON_COMMANDS } from "../constants";
import { Logger } from "../logger";
import { WorkspaceFolderRaw, WorkspaceSettings } from "../types";
import { resolvePath, VSCodeUtils } from "../utils";
import { DendronWorkspace } from "../workspace";
import { BasicCommand } from "./base";

type CommandOpts = {
  vname?: string;
  vpath: string;
  vpathOrig: string;
};

type CommandOutput = { vault: DVault };

export { CommandOpts as VaultAddCommandOpts };

export class VaultAddCommand extends BasicCommand<CommandOpts, CommandOutput> {
  static key = DENDRON_COMMANDS.VAULT_ADD.key;
  async gatherInputs(): Promise<any> {
    const vpath = await VSCodeUtils.showInputBox({
      prompt: "Path to your new vault",
      placeHolder: "vault-2",
    });
    if (_.isUndefined(vpath)) {
      return;
    }
    const vname = await VSCodeUtils.showInputBox({
      prompt: "Name of new vault (optional, press enter to skip)",
    });
    // validate path
    if (_.isEmpty(vpath) || _.isUndefined(vpath)) {
      return window.showErrorMessage("need to specify value for path");
    }
    const vpathFull = resolvePath(vpath, DendronWorkspace.wsRoot());
    // if (fs.existsSync(vpath) && fs.readdirSync(vpath).length !== 0) {
    //   return window.showErrorMessage(
    //     `vault path ${vpathFull} already exists and is not empty`
    //   );
    // }
    return { vname, vpath: vpathFull, vpathOrig: vpath };
  }

  async execute(opts: CommandOpts) {
    const ctx = "VaultAdd";
    const vault: DVault = { fsPath: opts.vpath };
    if (opts.vname) {
      vault.name = opts.vname;
    }
    const wsRoot = DendronWorkspace.wsRoot() as string;
    const wsService = new WorkspaceService({ wsRoot });
    Logger.info({ ctx, msg: "preCreateVault", vault });
    await wsService.createVault({ vault });

    // workspace file
    const wsPath = DendronWorkspace.workspaceFile().fsPath;
    let out = (await readJSONWithComments(wsPath)) as WorkspaceSettings;
    if (!_.find(out.folders, (ent) => ent.path === vault.fsPath)) {
      const vault2Folder: WorkspaceFolderRaw = { path: vault.fsPath };
      if (vault.name) {
        vault2Folder.name = vault.name;
      }
      const folders = out.folders.concat(vault2Folder);
      out = assignJSONWithComment({ folders }, out);
      await writeJSONWithComments(wsPath, out);
    }
    window.showInformationMessage("finished adding vault");
    if (getStage() !== "test") {
      await commands.executeCommand("workbench.action.reloadWindow");
    }
    return { vault };
  }
}
