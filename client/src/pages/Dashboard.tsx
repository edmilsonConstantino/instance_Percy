import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { 
  DollarSign, 
  ShoppingBag, 
  Package, 
  AlertTriangle, 
  TrendingUp,
  ArrowRight,
  Calendar,
  Users,
  Activity,
  Zap,
  Star,
  Bell,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Link } from 'wouter';
import { formatCurrency } from '@/lib/utils';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, BarChart, Bar, Cell, PieChart, Pie, Legend } from 'recharts';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { salesApi, productsApi, usersApi, notificationsApi } from '@/lib/api';

export default function Dashboard() {
  const { user } = useAuth();
  const [slideIndex, setSlideIndex] = useState(0);
  
  // Auto-scroll carousel
  useEffect(() => {
    const interval = setInterval(() => {
      const container = document.querySelector('.scroll-smooth') as HTMLElement;
      if (container) {
        container.scrollBy({ left: 300, behavior: 'smooth' });
      }
    }, 4000); // Change slide every 4 seconds
    return () => clearInterval(interval);
  }, []);

  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['/api/sales'],
    queryFn: salesApi.getAll
  });

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['/api/products'],
    queryFn: productsApi.getAll
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['/api/users'],
    queryFn: usersApi.getAll
  });

  const { data: notifications = [], isLoading: notificationsLoading } = useQuery({
    queryKey: ['/api/notifications'],
    queryFn: notificationsApi.getAll
  });

  const totalSalesToday = sales
    .filter(s => new Date(s.createdAt).toDateString() === new Date().toDateString())
    .reduce((acc, curr) => acc + parseFloat(curr.total), 0);

  const totalOrdersToday = sales
    .filter(s => new Date(s.createdAt).toDateString() === new Date().toDateString())
    .length;

  const lowStockCount = products.filter(p => parseFloat(p.stock) <= parseFloat(p.minStock)).length;
  const activeUsers = users.length;

  // Top 5 produtos mais vendidos
  const topProducts = sales
    .flatMap(s => s.items)
    .reduce((acc, item) => {
      const existing = acc.find(p => p.productId === item.productId);
      if (existing) {
        existing.quantity += item.quantity;
        existing.revenue += item.priceAtSale * item.quantity;
      } else {
        acc.push({ productId: item.productId, quantity: item.quantity, revenue: item.priceAtSale * item.quantity });
      }
      return acc;
    }, [] as any[])
    .map(item => {
      const product = products.find(p => p.id === item.productId);
      return { ...item, name: product?.name || 'Desconhecido', ...item };
    })
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  // Produtos com alerta de estoque baixo
  const lowStockProducts = products
    .filter(p => parseFloat(p.stock) <= parseFloat(p.minStock))
    .sort((a, b) => parseFloat(a.stock) - parseFloat(b.stock))
    .slice(0, 5);

  const chartData = Array.from({ length: 7 }).map((_, i) => {
    const date = subDays(new Date(), 6 - i);
    const dateStr = format(date, 'dd/MM', { locale: ptBR });
    const daySales = sales
      .filter(s => new Date(s.createdAt).toDateString() === date.toDateString())
      .reduce((acc, curr) => acc + parseFloat(curr.total), 0);
    
    return { date: dateStr, total: daySales, orders: sales.filter(s => new Date(s.createdAt).toDateString() === date.toDateString()).length };
  });

  const isLoading = salesLoading || productsLoading || usersLoading || notificationsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-muted-foreground">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary/90 to-primary/70 p-5 sm:p-8 md:p-12 text-primary-foreground shadow-2xl shadow-primary/20">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-white/10 blur-3xl"></div>
        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 h-40 w-40 rounded-full bg-black/10 blur-2xl"></div>

        <div className="relative z-10 flex flex-col gap-5">
          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-heading font-bold tracking-tight">
              Bem-vindo, {user?.name.split(' ')[0]}! 👋
            </h1>
            <p className="text-primary-foreground/80 text-sm sm:text-base md:text-lg max-w-xl">
              Aqui está o resumo das atividades da sua mercearia hoje.{' '}
              Você tem <span className="font-bold bg-white/20 px-2 py-0.5 rounded-full">{lowStockCount} alertas</span> precisando de atenção.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:flex sm:gap-3">
            <Link href="/reports">
              <Button variant="secondary" className="w-full shadow-lg bg-white/10 hover:bg-white/20 text-white border-none backdrop-blur-sm text-sm">
                <Activity className="mr-1.5 h-4 w-4 shrink-0" />
                Ver Relatórios
              </Button>
            </Link>
            <Link href="/pos">
              <Button size="lg" className="w-full shadow-xl bg-white text-primary hover:bg-white/90 font-bold border-none text-sm">
                <Zap className="mr-1.5 h-4 w-4 fill-current shrink-0" />
                Nova Venda
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="relative">
        <div className="flex gap-4 overflow-x-auto pb-4 scroll-smooth snap-x snap-mandatory">
          {[
            { title: 'Vendas Hoje', value: formatCurrency(totalSalesToday), icon: DollarSign, bg: 'green', trend: '+12.5%', test: 'text-sales-today' },
            { title: 'Pedidos', value: totalOrdersToday, icon: ShoppingBag, bg: 'blue', trend: `+${Math.floor(Math.random() * 5)}`, test: 'text-orders-today' },
            { title: 'Alertas Estoque', value: lowStockCount, icon: AlertTriangle, bg: 'red', trend: lowStockCount > 0 ? 'CRÍTICO' : 'Normal', test: 'text-low-stock' },
            { title: 'Equipe Ativa', value: activeUsers, icon: Users, bg: 'orange', trend: 'Online', test: 'text-active-users' }
          ].map((card, idx) => {
            const Icon = card.icon;
            const bgGradient = card.bg === 'green' ? 'from-green-50 to-green-100' : card.bg === 'blue' ? 'from-blue-50 to-blue-100' : card.bg === 'red' ? 'from-red-50 to-red-100' : 'from-orange-50 to-orange-100';
            const iconBg = card.bg === 'green' ? 'bg-green-100 text-green-600' : card.bg === 'blue' ? 'bg-blue-100 text-blue-600' : card.bg === 'red' ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600';
            const bgDot = card.bg === 'green' ? 'bg-green-500/10' : card.bg === 'blue' ? 'bg-blue-500/10' : card.bg === 'red' ? 'bg-red-500/10' : 'bg-orange-500/10';
            const bgDotHover = card.bg === 'green' ? 'group-hover:bg-green-500/20' : card.bg === 'blue' ? 'group-hover:bg-blue-500/20' : card.bg === 'red' ? 'group-hover:bg-red-500/20' : 'group-hover:bg-orange-500/20';
            const trendBg = card.bg === 'red' && card.trend === 'CRÍTICO' ? 'text-red-600 bg-red-100' : card.bg === 'green' ? 'text-green-500 bg-green-100' : card.bg === 'blue' ? 'text-blue-500 bg-blue-100' : 'text-orange-500 bg-orange-100';
            
            return (
              <Card key={idx} className={`relative overflow-hidden border-none shadow-lg bg-gradient-to-br ${bgGradient} hover:scale-[1.02] transition-transform duration-300 group flex-shrink-0 w-full sm:w-72 snap-start`}>
                <div className={`absolute right-0 top-0 h-24 w-24 ${bgDot} rounded-bl-full -mr-4 -mt-4 transition-all ${bgDotHover}`}></div>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
                  <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center ${iconBg}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </CardHeader>
                <CardContent className="relative z-10">
                  <div className="text-3xl font-bold text-gray-800" data-testid={card.test}>{card.value}</div>
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    <span className={`${trendBg} font-bold flex items-center px-1.5 py-0.5 rounded-md`}>
                      <TrendingUp className="h-3 w-3 mr-1" /> {card.trend}
                    </span>
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="border-none shadow-xl bg-gradient-to-br from-white to-red-50/30">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Bell className="h-5 w-5 text-red-500" />
              ⚠️ Produtos com Alerta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {lowStockProducts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum alerta de estoque</p>
              ) : (
                lowStockProducts.map(p => (
                  <div key={p.id} className="flex justify-between items-start p-2 bg-red-50 rounded-lg border border-red-200">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{p.name}</p>
                      <p className="text-xs text-red-600 font-bold">
                        {parseFloat(p.stock)} {p.unit} (min: {parseFloat(p.minStock)})
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs bg-red-500 text-white px-2 py-1 rounded font-bold">REORDENAR</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              Top 5 Produtos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topProducts.map((p, idx) => (
                <div key={p.productId} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-2 flex-1">
                    <span className="font-bold text-lg text-primary/60">#{idx + 1}</span>
                    <div>
                      <p className="text-sm font-medium truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.quantity} vendas</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-green-600">{formatCurrency(p.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-none shadow-xl bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-gray-800">Desempenho Semanal</CardTitle>
                <CardDescription>Receita diária vs. meta esperada</CardDescription>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="rounded-full text-xs h-7">7 Dias</Button>
                <Button variant="ghost" size="sm" className="rounded-full text-xs h-7 text-muted-foreground">30 Dias</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pl-0">
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(150 60% 35%)" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="hsl(150 60% 35%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#888888" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    dy={10}
                  />
                  <YAxis 
                    stroke="#888888" 
                    fontSize={12} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(value) => `MT ${value}`} 
                    dx={-10}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                      border: 'none',
                      borderRadius: '12px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                    }}
                    formatter={(value: number) => [`MT ${value.toFixed(2)}`, 'Vendas']}
                    labelStyle={{ color: '#666', marginBottom: '0.5rem' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="total" 
                    stroke="hsl(150 60% 35%)" 
                    strokeWidth={4}
                    fillOpacity={1} 
                    fill="url(#colorTotal)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm h-full flex flex-col">
            <CardHeader>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Feed de Atividades
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 relative p-0">
              <div className="overflow-y-auto max-h-[420px] px-6 py-2 space-y-1">
                {/* Notificações recentes */}
                {notifications.slice(0, 3).map((notif) => (
                  <div key={notif.id} className="flex gap-3 items-start group py-2 border-b border-gray-50 last:border-0">
                    <div className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ring-2 ring-white ${
                      notif.type === 'warning' ? 'bg-yellow-500' :
                      notif.type === 'success' ? 'bg-green-500' :
                      notif.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-snug text-gray-800 truncate">{notif.message}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(notif.createdAt), "HH:mm", { locale: ptBR })}</p>
                    </div>
                  </div>
                ))}

                {/* Vendas dos últimos 2 dias agrupadas */}
                {(() => {
                  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
                  const yesterdayStart = subDays(todayStart, 1);
                  const twoDaysAgoStart = subDays(todayStart, 2);

                  const recentSales = sales
                    .filter(s => new Date(s.createdAt) >= twoDaysAgoStart)
                    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

                  if (recentSales.length === 0) return (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhuma venda nos últimos 2 dias</p>
                  );

                  const paymentLabel = (m: string) => {
                    if (m === 'card') return 'Cartão';
                    if (m === 'pix' || m === 'mpesa') return 'M-Pesa';
                    if (m === 'emola') return 'e-Mola';
                    return 'Dinheiro';
                  };

                  let lastGroup = '';
                  return recentSales.map((sale) => {
                    const saleDate = new Date(sale.createdAt); saleDate.setHours(0,0,0,0);
                    let group = saleDate.getTime() === todayStart.getTime() ? 'Hoje'
                      : saleDate.getTime() === yesterdayStart.getTime() ? 'Ontem'
                      : format(saleDate, 'dd/MM', { locale: ptBR });
                    const showHeader = group !== lastGroup;
                    lastGroup = group;
                    return (
                      <div key={sale.id}>
                        {showHeader && (
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest pt-3 pb-1">{group}</p>
                        )}
                        <div className="flex gap-3 items-start group py-2 border-b border-gray-50 last:border-0">
                          <div className="mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ring-2 ring-white bg-primary" />
                          <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center gap-2">
                              <p className="text-sm font-medium text-gray-800">Venda #{sale.id.slice(-4)}</p>
                              <span className="text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
                                {formatCurrency(parseFloat(sale.total))}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {sale.items.length} {sale.items.length === 1 ? 'item' : 'itens'} • {paymentLabel(sale.paymentMethod ?? '')} • {format(new Date(sale.createdAt), "HH:mm", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </CardContent>
            <div className="p-4 border-t border-gray-100 bg-gray-50/50 rounded-b-xl">
              <Link href="/reports">
                <Button variant="ghost" className="w-full text-primary text-sm hover:bg-primary/5">Ver todo o histórico</Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
