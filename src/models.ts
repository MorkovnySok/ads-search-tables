import { setAliasFromTableName } from "./extension";

export class Table {
  name: string;
  _alias?: string;

  get alias(): string {
    return this._alias ?? setAliasFromTableName(this);
  }
  set alias(alias: string) {
    this._alias = alias;
  }

  constructor(name: string) {
    this.name = name;
  }
}

export interface RelationTypeQuery {
  parentTable: string;
  parentColumn: string;
  childTable: string;
  childColumn: string;
}

export class RelationType {
  table: Table;
  joinableTables: JoinableTable[];

  constructor(table: Table, joinableTables: JoinableTable[]) {
    this.table = table;
    this.joinableTables = joinableTables;
  }
}

export class JoinableTable {
  table: Table;
  column: string;
  parentColumn: string;
  parentTable: Table;

  constructor(
    table: Table,
    column: string,
    parentColumn: string,
    parentTable: Table,
  ) {
    this.table = table;
    this.column = column;
    this.parentColumn = parentColumn;
    this.parentTable = parentTable;
  }
}
