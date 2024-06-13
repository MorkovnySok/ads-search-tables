import {
  JoinableTable,
  RelationType,
  RelationTypeQuery,
  Table,
} from "./models";

export function buildRelations(sqlData: RelationTypeQuery[]): RelationType[] {
  const allTables = sqlData
    .map((x) => x.parentTable)
    .concat(sqlData.map((x) => x.childTable));
  const uniqueTables = [...new Set(allTables)];

  const result: RelationType[] = [];
  for (const tableName of uniqueTables) {
    const table: Table = new Table(tableName);
    const joinableTables: JoinableTable[] = [];
    sqlData
      .filter((x) => x.parentTable === tableName)
      .forEach((x) => {
        joinableTables.push(
          new JoinableTable(
            new Table(x.childTable),
            x.childColumn,
            x.parentColumn,
            table,
          ),
        );
      });

    sqlData
      .filter((x) => x.childTable === tableName)
      .forEach((x) => {
        joinableTables.push(
          new JoinableTable(
            new Table(x.parentTable),
            x.parentColumn,
            x.childColumn,
            table,
          ),
        );
      });

    result.push(new RelationType(table, joinableTables));
  }

  return result;
}
