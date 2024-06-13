"use strict";
import * as vscode from "vscode";
import * as azdata from "azdata";

interface Table {
  name: string;
  alias?: string;
}

interface RelationTypeQuery {
  parentTable: string;
  parentColumn: string;
  childTable: string;
  childColumn: string;
}

interface RelationType {
  parentTable: Table;
  parentColumn: string;
  childTable: Table;
  childColumn: string;
}

const fullTableNamesSql = `
SELECT CONCAT(s.name, '.', t.name) [name] from sys.tables t
join sys.schemas s on s.schema_id = t.schema_id
`;

const relationsSql = `
SELECT CONCAT(s.name, '.', TP.name) [parentTable], CP.name parentColumn, 
       CONCAT(s2.name, '.', RFK.name) [childTable], CR.name childColumn
FROM sys.foreign_keys AS FK
    JOIN sys.tables AS TP ON FK.parent_object_id = TP.object_id
    JOIN sys.foreign_key_columns AS FKC ON FK.object_id = FKC.constraint_object_id
    JOIN sys.columns AS CP ON FKC.parent_object_id = CP.object_id AND FKC.parent_column_id = CP.column_id
    JOIN sys.columns AS CR ON FKC.referenced_object_id = CR.object_id AND FKC.referenced_column_id = CR.column_id
    JOIN sys.tables AS RFK ON FKC.referenced_object_id = RFK.object_id
    JOIN sys.schemas s on s.schema_id = TP.schema_id
    JOIN sys.schemas s2 on s2.schema_id = RFK.schema_id
`;

let tableNames: Table[] = [];
let relations: RelationType[] = [];

export function activate(context: vscode.ExtensionContext) {
  let adsLog = vscode.window.createOutputChannel("ADS Search Tables");
  adsLog.appendLine("ADS Search Tables Activated");

  const completionProvider = vscode.languages.registerCompletionItemProvider(
    "sql", // only for SQL files
    {
      provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
      ) {
        // only after from or join keywords
        const text = document.getText(
          new vscode.Range(new vscode.Position(position.line, 0), position),
        );
        const match = text.match(/(from|join)\s+(\w*)$/i);
        if (!match) {
          return [];
        }

        return tableNames.map((x) => {
          const alias = getAliasFromTableName(x);
          return new vscode.CompletionItem(
            `${x.name} ${alias}`,
            vscode.CompletionItemKind.TypeParameter,
          );
        });
      },
    },
  );

  const joinSuggestionsProvider =
    vscode.languages.registerCompletionItemProvider(
      "sql", // only for SQL files
      {
        provideCompletionItems(
          document: vscode.TextDocument,
          position: vscode.Position,
        ) {
          // only after ON keyword
          const text = document.getText(
            new vscode.Range(new vscode.Position(position.line, 0), position),
          );
          const onWordMatch = text.replace("=", "").match(/on\s+(\w*)$/i);
          const joinWordMatch = text.replace("=", "").match(/join\s+(\w*)$/i);
          if (!onWordMatch && !joinWordMatch) {
            return [];
          }

          const usedTables = parseSqlQueries(document, position);
          for (const usedTable of usedTables) {
            usedTable.alias = getAliasFromTableName(usedTable, usedTables);
          }

          if (joinWordMatch) {
            return processJoinSuggestion(relations, usedTables);
          }

          if (onWordMatch) {
            return processOnWordSuggestion(relations, usedTables);
          }
        },
      },
      "=",
      " ",
    );

  context.subscriptions.push(completionProvider);
  context.subscriptions.push(joinSuggestionsProvider);

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "ads-search-tables.helloWorld",
      async () => {
        tableNames = await executeQuery<Table>(fullTableNamesSql);
        const relationsResult =
          await executeQuery<RelationTypeQuery>(relationsSql);
        relations = relationsResult.map((x) => {
          return {
            childColumn: x.childColumn,
            childTable: { name: x.childTable, alias: "" },
            parentColumn: x.parentColumn,
            parentTable: { name: x.parentTable, alias: "" },
          };
        });
      },
    ),
  );
}

// this method is called when your extension is deactivated
export function deactivate() {}

interface IDbColumn {
  columnName: string;
}

class GenericResultMapper<T extends object> {
  constructor(private data: T) {}

  mapResult(row: any[], columnInfo: IDbColumn[]): void {
    columnInfo.forEach((column, index) => {
      const propertyName = column.columnName;
      (this.data as any)[propertyName] = row[index].displayValue;
    });
  }
}

async function executeQuery<T extends object>(sql: string): Promise<T[]> {
  const connection = await azdata.connection.getCurrentConnection();
  const uri = await azdata.connection.getUriForConnection(
    connection.connectionId,
  );
  const provider = azdata.dataprotocol.getProvidersByType(
    azdata.DataProviderType.QueryProvider,
  )[0] as azdata.QueryProvider;
  const results = await provider.runQueryAndReturn(uri, sql);

  return results.rows.map((row) => {
    const rowObject = {} as T;
    const resultMapper = new GenericResultMapper<T>(rowObject);
    resultMapper.mapResult(row, results.columnInfo as IDbColumn[]);
    return rowObject;
  });
}

function parseSqlQueries(
  document: vscode.TextDocument,
  position: vscode.Position,
): Table[] {
  const sqlText = document.getText();
  const tablesUsed: string[] = [];

  const lines = sqlText.split("\n");
  const currentLine = position.line;

  let queryStart: number | null = null;

  // Iterate from the cursor position to the beginning of the document
  for (let i = currentLine; i >= 0; i--) {
    const line = lines[i].trim();
    const selectIndex = line.search(/\b(?:SELECT|UPDATE|DELETE)\b/i);

    if (selectIndex !== -1) {
      queryStart = i;
      break;
    }
  }

  if (queryStart === null) {
    return [];
  }

  const queryLines = lines.slice(queryStart, currentLine + 1);
  const query = queryLines.join(" ");

  // Use a simple parser to extract table names
  const words = query.split(/\s+/);
  let isFromJoinClause = false;

  for (const word of words) {
    if (isFromJoinClause && word !== "") {
      tablesUsed.push(word);
      isFromJoinClause = false;
    }

    if (/\b(?:FROM|JOIN)\b/i.test(word)) {
      isFromJoinClause = true;
    }
  }

  return tablesUsed.map((x) => {
    return {
      name: x,
    } as Table;
  });
}

function getAliasFromTableName(
  table: Table,
  tablesUsedInQuery?: Table[] | undefined,
): string {
  const nameParts = table.name.split(".");
  let tableNameWithoutSchema;
  if (nameParts.length > 1) {
    tableNameWithoutSchema = nameParts[1];
  } else {
    tableNameWithoutSchema = nameParts[0];
  }
  // returns every capital letter in the table name
  const regex = /[A-Z]/g;
  const matches = tableNameWithoutSchema.match(regex);
  if (matches) {
    let alias = matches.join("");
    if (tablesUsedInQuery) {
      const aliasUsages = tablesUsedInQuery.filter(
        (x) => x.alias === alias,
      ).length;
      alias = aliasUsages > 0 ? alias + aliasUsages.toString() : alias;
    }
    table.alias = alias;
    relations
      .filter((x) => x.parentTable.name === table.name)
      .forEach((x) => (x.parentTable.alias = table.alias));

    return table.alias;
  } else {
    table.alias = tableNameWithoutSchema;
    return table.alias;
  }
}

function processJoinSuggestion(
  relations: RelationType[],
  usedTables: Table[],
): vscode.ProviderResult<
  vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>
> {
  const suggestedRelations = relations.filter((r) => {
    return (
      usedTables.map((x) => x.name).includes(r.parentTable.name) ||
      usedTables.map((x) => x.name).includes(r.childTable.name)
    );
  });

  const suggestionsSet = new Set<string>(
    suggestedRelations.map((x) => {
      const childAlias = getAliasFromTableName(x.childTable, usedTables);
      return `${x.childTable.name} ${childAlias} ON ${x.parentTable.alias}.${
        x.parentColumn
      } = ${childAlias}.${x.childColumn}`;
    }),
  );
  const result: vscode.ProviderResult<
    vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>
  > = [];
  suggestionsSet.forEach((x) =>
    result.push(
      new vscode.CompletionItem(x, vscode.CompletionItemKind.TypeParameter),
    ),
  );
  return result;
}

function processOnWordSuggestion(
  relations: RelationType[],
  usedTables: Table[],
) {
  const currentTable = usedTables.pop();
  const suggestedRelations = relations.filter((r) => {
    return (
      (usedTables.includes(r.parentTable) && r.childTable === currentTable) ||
      (usedTables.includes(r.childTable) && r.parentTable === currentTable)
    );
  });

  const suggestionsSet = new Set<string>(
    suggestedRelations.map(
      (x) =>
        `${getAliasFromTableName(x.parentTable, usedTables)}.${
          x.parentColumn
        } = ${getAliasFromTableName(x.childTable, usedTables)}.${x.childColumn}`,
    ),
  );
  const result: vscode.ProviderResult<
    vscode.CompletionItem[] | vscode.CompletionList<vscode.CompletionItem>
  > = [];
  suggestionsSet.forEach((x) =>
    result.push(
      new vscode.CompletionItem(x, vscode.CompletionItemKind.TypeParameter),
    ),
  );
  return result;
}
