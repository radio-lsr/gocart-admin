import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const SalesChart = ({ data = [] }) => {
  // Données par défaut si aucune n'est fournie
  const defaultData = [
    { name: 'Lun', ventes: 4000, commandes: 24 },
    { name: 'Mar', ventes: 3000, commandes: 18 },
    { name: 'Mer', ventes: 5000, commandes: 30 },
    { name: 'Jeu', ventes: 4500, commandes: 27 },
    { name: 'Ven', ventes: 6000, commandes: 35 },
    { name: 'Sam', ventes: 5500, commandes: 32 },
    { name: 'Dim', ventes: 3500, commandes: 20 },
  ];

  const chartData = data.length > 0 ? data : defaultData;

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Ventes et commandes</h2>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="ventes" stroke="#8884d8" name="Ventes (€)" />
            <Line yAxisId="right" type="monotone" dataKey="commandes" stroke="#82ca9d" name="Commandes" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SalesChart;