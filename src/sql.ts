export const fullTableNamesSql = `
SELECT CONCAT(s.name, '.', t.name) [name] from sys.tables t
join sys.schemas s on s.schema_id = t.schema_id
`;

export const relationsSql = `
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
