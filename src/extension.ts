"use strict";
import * as vscode from "vscode";
import * as azdata from "azdata";

export function activate(context: vscode.ExtensionContext) {
  let adsLog = vscode.window.createOutputChannel("ADS Search Tables");
  adsLog.appendLine("ADS Search Tables Activated");
  let tableNames: string[] = [];

  const completionProvider = vscode.languages.registerCompletionItemProvider(
    "sql", // only for SQL files
    {
      provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position
      ) {
        // only after from or join keywords
        const text = document.getText(
          new vscode.Range(new vscode.Position(position.line, 0), position)
        );
        const match = text.match(/(from|join)\s+(\w*)$/i);
        if (!match) {
          return [];
        }

        return tableNames.map(
          (x) => new vscode.CompletionItem(x, vscode.CompletionItemKind.Keyword)
        );
      },
    }
  );

  context.subscriptions.push(completionProvider);

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "ads-search-tables.helloWorld",
      async () => {
        const connection = await azdata.connection.getCurrentConnection();
        const uri = await azdata.connection.getUriForConnection(
          connection.connectionId
        );
        console.log(connection.databaseName);
        const provider = azdata.dataprotocol.getProvidersByType(
          azdata.DataProviderType.QueryProvider
        )[0] as azdata.QueryProvider;
        const results = await provider.runQueryAndReturn(
          uri,
          `SELECT CONCAT(s.name, '.', t.name) from sys.tables t
           join sys.schemas s on s.schema_id = t.schema_id`
        );
        adsLog.appendLine(JSON.stringify("table names loaded"));
        tableNames = results.rows.map((row) => row[0].displayValue);
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "ads-search-tables.showCurrentConnection",
      () => {
        azdata.connection.getCurrentConnection().then(
          (connection) => {
            console.log(connection);
            let connectionId = connection
              ? connection.connectionId
              : "No connection found!";
            vscode.window.showInformationMessage(connectionId);
          },
          (error) => {
            console.info(error);
          }
        );
      }
    )
  );
}

// this method is called when your extension is deactivated
export function deactivate() {}
