import { useState, useEffect } from 'react';
import Link from 'next/link';
import dashboardService from '@/src/services/dashboardService';

interface RecentOrdersProps {
  sellerId: string;
  limit?: number;
}

interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  total: number;
  productCount: number;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  createdAt: string;
}

export default function RecentOrders({ sellerId, limit = 3 }: RecentOrdersProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!sellerId) return;
      
      setLoading(true);
      try {
        const data = await dashboardService.getRecentOrders(sellerId, limit);
        setOrders(data);
      } catch (error) {
        console.error('Erreur lors du chargement des commandes récentes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [sellerId, limit]);

  // Format des montants en FCFA
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Helper pour déterminer la couleur du statut
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Helper pour traduire le statut
  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'En attente';
      case 'processing': return 'En traitement';
      case 'completed': return 'Terminé';
      case 'cancelled': return 'Annulé';
      default: return status;
    }
  };

  return (
    <div className="w-full">
      {loading ? (
        <div className="flex justify-center py-6">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-orange-500"></div>
        </div>
      ) : orders.length > 0 ? (
        <div className="space-y-4">
          {orders.map((order) => (
            <div key={order.id} className="flex items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
              <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-500 font-medium">
                {order.customerName.substring(0, 1).toUpperCase()}
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-gray-800">{order.customerName}</p>
                <p className="text-xs text-gray-500">
                  {order.productCount} produit{order.productCount > 1 ? 's' : ''} • {formatCurrency(order.total)}
                </p>
              </div>
              <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(order.status)}`}>
                {getStatusText(order.status)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-6">
          <p className="text-gray-500">Aucune commande récente</p>
          <p className="text-sm text-gray-400 mt-1">Les nouvelles commandes apparaîtront ici</p>
        </div>
      )}
      
      <div className="mt-4 text-center">
        <Link href="/dashboard/orders" className="text-sm text-orange-500 hover:text-orange-600 font-medium">
          Voir toutes les commandes
        </Link>
      </div>
    </div>
  );
}