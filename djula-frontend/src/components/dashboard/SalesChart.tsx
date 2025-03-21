import { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend 
} from 'recharts';
import dashboardService from '@/src/services/dashboardService';

interface SalesChartProps {
  sellerId: string;
}

// Définir l'interface pour les données du graphique
interface SalesDataPoint {
  date: string;
  sales: number;
  orders: number;
}

export default function SalesChart({ sellerId }: SalesChartProps) {
  const [data, setData] = useState<SalesDataPoint[]>([]);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChartData = async () => {
      setLoading(true);
      try {
        const response = await dashboardService.getSalesChartData(sellerId, period);
        // Gérer à la fois les cas où response est directement un tableau ou un objet avec une propriété data
        const chartData = Array.isArray(response) ? response : response.data || [];
        setData(chartData);
      } catch (error) {
        console.error('Erreur de chargement du graphique:', error);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    if (sellerId) {
      fetchChartData();
    }
  }, [sellerId, period]);

  return (
    <div className="w-full h-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-800">Évolution des ventes</h3>
        <div className="flex space-x-2">
          <button 
            onClick={() => setPeriod('7d')}
            className={`px-3 py-1 text-xs rounded ${period === '7d' 
              ? 'bg-orange-500 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            7 jours
          </button>
          <button 
            onClick={() => setPeriod('30d')}
            className={`px-3 py-1 text-xs rounded ${period === '30d' 
              ? 'bg-orange-500 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            30 jours
          </button>
          <button 
            onClick={() => setPeriod('90d')}
            className={`px-3 py-1 text-xs rounded ${period === '90d' 
              ? 'bg-orange-500 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            90 jours
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-orange-500"></div>
        </div>
      ) : data.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tickFormatter={(date) => new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} />
            <YAxis />
            <Tooltip formatter={(value) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF' }).format(value as number)} />
            <Legend />
            <Line type="monotone" dataKey="sales" name="Ventes" stroke="#ff6b00" strokeWidth={2} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey="orders" name="Commandes" stroke="#10b981" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="h-64 flex flex-col items-center justify-center">
          <p className="text-gray-500">Pas de données disponibles</p>
          <p className="text-sm text-gray-400 mt-2">Les ventes apparaîtront ici</p>
        </div>
      )}
    </div>
  );
}