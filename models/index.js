const sequelize = require('../database');
const Mercado = require('./Mercado');
const Compra = require('./Compra');
const ItemComprado = require('./ItemComprado');
const Produto = require('./Produto');
const Variacao = require('./Variacao');
const UnidadeMedida = require('./UnidadeMedida');
const Usuario = require('./Usuario');

// Associations
Mercado.hasMany(Compra, { foreignKey: 'mercado_id' });
Compra.belongsTo(Mercado, { foreignKey: 'mercado_id' });

UnidadeMedida.hasMany(Compra, { foreignKey: 'unidade_medida_id' });
Compra.belongsTo(UnidadeMedida, { foreignKey: 'unidade_medida_id' });

Compra.hasMany(ItemComprado, { foreignKey: 'compra_id', as: 'itens', onDelete: 'CASCADE' });
ItemComprado.belongsTo(Compra, { foreignKey: 'compra_id' });

Variacao.hasMany(ItemComprado, { foreignKey: 'variacao_id' });
ItemComprado.belongsTo(Variacao, { foreignKey: 'variacao_id' });

Produto.hasMany(Variacao, { foreignKey: 'produto_id' });
Variacao.belongsTo(Produto, { foreignKey: 'produto_id' });

UnidadeMedida.hasMany(Variacao, { foreignKey: 'unidade_medida_id' });
Variacao.belongsTo(UnidadeMedida, { foreignKey: 'unidade_medida_id' });

module.exports = {
  sequelize,
  Mercado,
  Compra,
  ItemComprado,
  Produto,
  Variacao,
  UnidadeMedida,
  Usuario
};
