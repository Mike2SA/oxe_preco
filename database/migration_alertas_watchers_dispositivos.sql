-- =====================================================
-- Migration: novas tabelas + colunas de geolocalizacao/catalogo
--   - Novas tabelas: Watchers, Alertas, Dispositivos
--   - Novas colunas: Mercados (lat, lng, endereco, cidade)
--                    Produtos (categoriaId, eans)
-- Dialeto: SQL Server (T-SQL) - execute no SSMS (bloco a bloco)
-- Idempotente: pode ser reexecutada sem erro se as mudancas ja existirem
-- Depende de: migration_uuid_standardize.sql (todos os PKs devem ser UNIQUEIDENTIFIER)
-- =====================================================

-- =====================================================
-- PARTE 1: Mercados - colunas de geolocalizacao/endereco
-- =====================================================

IF COL_LENGTH('Mercados', 'lat') IS NULL
    ALTER TABLE Mercados ADD lat DECIMAL(10, 6) NULL;
GO

IF COL_LENGTH('Mercados', 'lng') IS NULL
    ALTER TABLE Mercados ADD lng DECIMAL(10, 6) NULL;
GO

IF COL_LENGTH('Mercados', 'endereco') IS NULL
    ALTER TABLE Mercados ADD endereco NVARCHAR(255) NULL;
GO

IF COL_LENGTH('Mercados', 'cidade') IS NULL
    ALTER TABLE Mercados ADD cidade NVARCHAR(100) NULL;
GO


-- =====================================================
-- PARTE 2: Produtos - categoria estruturada + codigos EAN
-- =====================================================

IF COL_LENGTH('Produtos', 'categoriaId') IS NULL
    ALTER TABLE Produtos ADD categoriaId NVARCHAR(50) NULL;
GO

-- DataTypes.JSON no dialeto mssql e armazenado como NVARCHAR(MAX)
IF COL_LENGTH('Produtos', 'eans') IS NULL
    ALTER TABLE Produtos ADD eans NVARCHAR(MAX) NULL;
GO


-- =====================================================
-- PARTE 3: Tabela Watchers
-- =====================================================

IF OBJECT_ID('Watchers', 'U') IS NULL
BEGIN
    CREATE TABLE Watchers (
        id          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        usuarioId   UNIQUEIDENTIFIER NOT NULL,
        produtoId   UNIQUEIDENTIFIER NOT NULL,
        variacaoId  UNIQUEIDENTIFIER NULL,
        mercadoId   UNIQUEIDENTIFIER NULL,
        precoAlvo   DECIMAL(10, 2)   NULL,
        modo        NVARCHAR(10)     NOT NULL DEFAULT 'queda',
        ativo       BIT              NOT NULL DEFAULT 1,
        criadoEm    DATETIME2        NOT NULL DEFAULT GETUTCDATE()
    );
END
GO


-- =====================================================
-- PARTE 4: Tabela Alertas
-- =====================================================

IF OBJECT_ID('Alertas', 'U') IS NULL
BEGIN
    CREATE TABLE Alertas (
        id                UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        watcherId         UNIQUEIDENTIFIER NULL,
        produtoId         UNIQUEIDENTIFIER NOT NULL,
        variacaoId        UNIQUEIDENTIFIER NULL,
        preco             DECIMAL(10, 2)   NOT NULL,
        precoNormalizado  DECIMAL(10, 4)   NULL,
        mercado           NVARCHAR(100)    NULL,
        data              DATETIME2        NOT NULL DEFAULT GETUTCDATE(),
        lido              BIT              NOT NULL DEFAULT 0
    );
END
GO


-- =====================================================
-- PARTE 5: Tabela Dispositivos (push notifications)
-- =====================================================

IF OBJECT_ID('Dispositivos', 'U') IS NULL
BEGIN
    CREATE TABLE Dispositivos (
        id          UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        usuarioId   UNIQUEIDENTIFIER NOT NULL,
        token       NVARCHAR(500)    NOT NULL,
        plataforma  NVARCHAR(20)     NULL,
        criadoEm    DATETIME2        NOT NULL DEFAULT GETUTCDATE()
    );
END
GO


-- =====================================================
-- PARTE 6: Indices de apoio
-- =====================================================

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Watchers_usuarioId' AND object_id = OBJECT_ID('Watchers'))
    CREATE INDEX IX_Watchers_usuarioId ON Watchers (usuarioId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Watchers_produtoId' AND object_id = OBJECT_ID('Watchers'))
    CREATE INDEX IX_Watchers_produtoId ON Watchers (produtoId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Alertas_watcherId' AND object_id = OBJECT_ID('Alertas'))
    CREATE INDEX IX_Alertas_watcherId ON Alertas (watcherId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Alertas_produtoId' AND object_id = OBJECT_ID('Alertas'))
    CREATE INDEX IX_Alertas_produtoId ON Alertas (produtoId);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Dispositivos_usuarioId' AND object_id = OBJECT_ID('Dispositivos'))
    CREATE INDEX IX_Dispositivos_usuarioId ON Dispositivos (usuarioId);
GO


-- =====================================================
-- PARTE 7: Foreign Keys
-- Requer que os PKs de Usuarios/Produtos/Variacoes/Mercados sejam UNIQUEIDENTIFIER
-- =====================================================

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Watchers_Usuarios')
    ALTER TABLE Watchers ADD CONSTRAINT FK_Watchers_Usuarios
        FOREIGN KEY (usuarioId) REFERENCES Usuarios (id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Watchers_Produtos')
    ALTER TABLE Watchers ADD CONSTRAINT FK_Watchers_Produtos
        FOREIGN KEY (produtoId) REFERENCES Produtos (id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Watchers_Variacoes')
    ALTER TABLE Watchers ADD CONSTRAINT FK_Watchers_Variacoes
        FOREIGN KEY (variacaoId) REFERENCES Variacoes (id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Watchers_Mercados')
    ALTER TABLE Watchers ADD CONSTRAINT FK_Watchers_Mercados
        FOREIGN KEY (mercadoId) REFERENCES Mercados (id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Alertas_Watchers')
    ALTER TABLE Alertas ADD CONSTRAINT FK_Alertas_Watchers
        FOREIGN KEY (watcherId) REFERENCES Watchers (id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Alertas_Produtos')
    ALTER TABLE Alertas ADD CONSTRAINT FK_Alertas_Produtos
        FOREIGN KEY (produtoId) REFERENCES Produtos (id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Alertas_Variacoes')
    ALTER TABLE Alertas ADD CONSTRAINT FK_Alertas_Variacoes
        FOREIGN KEY (variacaoId) REFERENCES Variacoes (id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Dispositivos_Usuarios')
    ALTER TABLE Dispositivos ADD CONSTRAINT FK_Dispositivos_Usuarios
        FOREIGN KEY (usuarioId) REFERENCES Usuarios (id);
GO


-- =====================================================
-- VERIFICACAO FINAL
-- =====================================================

SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME IN ('Watchers', 'Alertas', 'Dispositivos')
ORDER BY TABLE_NAME, ORDINAL_POSITION;

SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE
FROM INFORMATION_SCHEMA.COLUMNS
WHERE (TABLE_NAME = 'Mercados' AND COLUMN_NAME IN ('lat', 'lng', 'endereco', 'cidade'))
   OR (TABLE_NAME = 'Produtos' AND COLUMN_NAME IN ('categoriaId', 'eans'))
ORDER BY TABLE_NAME, COLUMN_NAME;
