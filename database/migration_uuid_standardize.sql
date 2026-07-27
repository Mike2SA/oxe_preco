-- =====================================================
-- Migration: Padronizar todos os IDs para UNIQUEIDENTIFIER
-- Tabelas afetadas: Usuarios, UnidadesMedida, Compras, Variacoes
-- Execute no SQL Server Management Studio (bloco a bloco)
-- =====================================================

-- =====================================================
-- PARTE 1: Usuarios.id  (INT IDENTITY → UNIQUEIDENTIFIER)
-- =====================================================

-- 1.1 Adiciona coluna UUID temporária
ALTER TABLE Usuarios ADD id_uuid UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID();
GO

-- 1.2 Remove a PK atual (INT)
DECLARE @pk_usuarios NVARCHAR(200);
SELECT @pk_usuarios = name
FROM sys.key_constraints
WHERE parent_object_id = OBJECT_ID('Usuarios') AND type = 'PK';
EXEC('ALTER TABLE Usuarios DROP CONSTRAINT [' + @pk_usuarios + ']');
GO

-- 1.3 Remove coluna id INT IDENTITY
ALTER TABLE Usuarios DROP COLUMN id;
GO

-- 1.4 Adiciona PK na nova coluna UUID
ALTER TABLE Usuarios
    ADD CONSTRAINT PK_Usuarios PRIMARY KEY (id_uuid);
GO

-- 1.5 Renomeia id_uuid → id
EXEC sp_rename 'Usuarios.id_uuid', 'id', 'COLUMN';
GO


-- =====================================================
-- PARTE 2: UnidadesMedida.id (TINYINT → UNIQUEIDENTIFIER)
-- + FK Compras.unidade_medida_id (TINYINT → UNIQUEIDENTIFIER)
-- + FK Variacoes.unidade_medida_id (TINYINT → UNIQUEIDENTIFIER)
-- =====================================================

-- 2.1 Dropa quaisquer FK constraints que referenciem UnidadesMedida
DECLARE @sql_fk NVARCHAR(MAX) = '';
SELECT @sql_fk = @sql_fk +
    'ALTER TABLE [' + OBJECT_NAME(parent_object_id) + '] DROP CONSTRAINT [' + name + ']; '
FROM sys.foreign_keys
WHERE referenced_object_id = OBJECT_ID('UnidadesMedida');
IF @sql_fk <> '' EXEC(@sql_fk);
GO

-- 2.2 Adiciona coluna UUID temporária em UnidadesMedida
ALTER TABLE UnidadesMedida ADD id_uuid UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID();
GO

-- 2.3 Adiciona colunas UUID temporárias nas tabelas filhas (para preservar a relação)
ALTER TABLE Compras    ADD unidade_medida_id_uuid UNIQUEIDENTIFIER NULL;
ALTER TABLE Variacoes  ADD unidade_medida_id_uuid UNIQUEIDENTIFIER NULL;
GO

-- 2.4 Propaga o novo UUID para as tabelas filhas (JOIN pelo ID antigo)
UPDATE c
SET c.unidade_medida_id_uuid = um.id_uuid
FROM Compras c
JOIN UnidadesMedida um ON c.unidade_medida_id = um.id;
GO

UPDATE v
SET v.unidade_medida_id_uuid = um.id_uuid
FROM Variacoes v
JOIN UnidadesMedida um ON v.unidade_medida_id = um.id;
GO

-- 2.5 Remove as colunas TINYINT antigas nas filhas
ALTER TABLE Compras   DROP COLUMN unidade_medida_id;
ALTER TABLE Variacoes DROP COLUMN unidade_medida_id;
GO

-- 2.6 Renomeia as novas colunas UUID
EXEC sp_rename 'Compras.unidade_medida_id_uuid',   'unidade_medida_id', 'COLUMN';
EXEC sp_rename 'Variacoes.unidade_medida_id_uuid',  'unidade_medida_id', 'COLUMN';
GO

-- 2.7 Torna NOT NULL (agora que os dados foram migrados)
ALTER TABLE Compras   ALTER COLUMN unidade_medida_id UNIQUEIDENTIFIER NOT NULL;
ALTER TABLE Variacoes ALTER COLUMN unidade_medida_id UNIQUEIDENTIFIER NOT NULL;
GO

-- 2.8 Remove a PK antiga de UnidadesMedida
DECLARE @pk_um NVARCHAR(200);
SELECT @pk_um = name
FROM sys.key_constraints
WHERE parent_object_id = OBJECT_ID('UnidadesMedida') AND type = 'PK';
EXEC('ALTER TABLE UnidadesMedida DROP CONSTRAINT [' + @pk_um + ']');
GO

-- 2.9 Remove a coluna TINYINT antiga
ALTER TABLE UnidadesMedida DROP COLUMN id;
GO

-- 2.10 Adiciona PK na nova coluna UUID
ALTER TABLE UnidadesMedida
    ADD CONSTRAINT PK_UnidadesMedida PRIMARY KEY (id_uuid);
GO

-- 2.11 Renomeia id_uuid → id
EXEC sp_rename 'UnidadesMedida.id_uuid', 'id', 'COLUMN';
GO

-- =====================================================
-- VERIFICAÇÃO FINAL
-- =====================================================
SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('Usuarios','UnidadesMedida','Compras','Variacoes')
  AND COLUMN_NAME IN ('id', 'user_id', 'unidade_medida_id')
ORDER BY TABLE_NAME, COLUMN_NAME;
