"use strict";
import * as vscode from "vscode";
import * as azdata from "azdata";

var fullTableNamesSql = `
SELECT CONCAT(s.name, '.', t.name) from sys.tables t
join sys.schemas s on s.schema_id = t.schema_id
`;

var relationsSql = `
SELECT CONCAT(s.name, '.', TP.name, '.', CP.name, ' = ', s2.name, '.', RFK.name, '.', CR.name)
FROM sys.foreign_keys AS FK
    JOIN sys.tables AS TP ON FK.parent_object_id = TP.object_id
    JOIN sys.foreign_key_columns AS FKC ON FK.object_id = FKC.constraint_object_id
    JOIN sys.columns AS CP ON FKC.parent_object_id = CP.object_id AND FKC.parent_column_id = CP.column_id
    JOIN sys.columns AS CR ON FKC.referenced_object_id = CR.object_id AND FKC.referenced_column_id = CR.column_id
    JOIN sys.tables AS RFK ON FKC.referenced_object_id = RFK.object_id
    JOIN sys.schemas s on s.schema_id = TP.schema_id
    JOIN sys.schemas s2 on s2.schema_id = RFK.schema_id
`;

export function activate(context: vscode.ExtensionContext) {
  let adsLog = vscode.window.createOutputChannel("ADS Search Tables");
  adsLog.appendLine("ADS Search Tables Activated");
  let tableNames: string[] = [];
  let relations: string[] = [];

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

  const joinSuggestionsProvider =
    vscode.languages.registerCompletionItemProvider(
      "sql", // only for SQL files
      {
        provideCompletionItems(
          document: vscode.TextDocument,
          position: vscode.Position
        ) {
          // only after ON keyword
          const text = document.getText(
            new vscode.Range(new vscode.Position(position.line, 0), position)
          );
          const match = text.match(/on\s+(\w*)$/i);
          if (!match) {
            return [];
          }

          const usedTables = parseSqlQueries(document);
          const suggestedRelations = relations.filter((r) =>
            usedTables.some((t) => r.includes(t))
          );

          console.log(suggestedRelations);
          const suggestionsSet = new Set<string>(suggestedRelations);
          console.log(suggestionsSet);
          const result: vscode.ProviderResult<
            | vscode.CompletionItem[]
            | vscode.CompletionList<vscode.CompletionItem>
          > = [];
          suggestionsSet.forEach((x) =>
            result.push(
              new vscode.CompletionItem(x, vscode.CompletionItemKind.Value)
            )
          );
          return result;
        },
      }
    );

  context.subscriptions.push(completionProvider);
  context.subscriptions.push(joinSuggestionsProvider);

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "ads-search-tables.helloWorld",
      async () => {
        tableNames = await executeQuery(fullTableNamesSql);
        relations = await executeQuery(relationsSql);
        console.trace(relations);
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

async function executeQuery(sql: string): Promise<string[]> {
  const connection = await azdata.connection.getCurrentConnection();
  const uri = await azdata.connection.getUriForConnection(
    connection.connectionId
  );
  const provider = azdata.dataprotocol.getProvidersByType(
    azdata.DataProviderType.QueryProvider
  )[0] as azdata.QueryProvider;
  const results = await provider.runQueryAndReturn(uri, sql);
  return results.rows.map((row) => row[0].displayValue);
}

function parseSqlQueries(document: vscode.TextDocument): string[] {
  const sqlText = document.getText();
  const tableRegex = /\b(?:from|join)\s+([^\s,]+)/gi;
  let match;
  const tablesUsed: string[] = [];

  while ((match = tableRegex.exec(sqlText)) !== null) {
    // Extract table names from the regex match
    const tableName = match[1];
    tablesUsed.push(tableName);
  }

  return tablesUsed;
}
