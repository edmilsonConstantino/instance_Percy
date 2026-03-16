import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, Pie, PieChart, Cell } from 'recharts';
import { format, subDays, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { useState } from 'react';
import { DateRange } from "react-day-picker"
import { Calendar as CalendarIcon, Download, TrendingUp, Users, ShoppingBag, Clock, TrendingDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useQuery } from '@tanstack/react-query';
import { salesApi, productsApi, categoriesApi, usersApi } from '@/lib/api';
import * as XLSX from 'xlsx';
import { toast } from '@/hooks/use-toast';

export default function Reports() {
  const { user } = useAuth();
  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['/api/sales'],
    queryFn: salesApi.getAll
  });

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['/api/products'],
    queryFn: productsApi.getAll
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['/api/categories'],
    queryFn: categoriesApi.getAll
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['/api/users'],
    queryFn: usersApi.getAll
  });

  const handleExportExcel = () => {
    try {
      const workbook = XLSX.utils.book_new();
      
      // Sheet 1: Relatório de Vendas
      const salesData = filteredSales.map(s => ({
        'ID': s.id.slice(-6),
        'Vendedor': users.find(u => u.id === s.userId)?.name || 'Desconhecido',
        'Total': parseFloat(s.total),
        'Itens': s.items.length,
        'Forma Pagamento': s.paymentMethod,
        'Data': format(new Date(s.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })
      }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(salesData), "Vendas");

      // Sheet 2: Performance por Vendedor
      const sellerPerformance = sales.reduce((acc, sale) => {
        const seller = users.find(u => u.id === sale.userId);
        const existing = acc.find(s => s.vendedor === (seller?.name || 'Desconhecido'));
        if (existing) {
          existing.vendas += 1;
          existing.total += parseFloat(sale.total);
        } else {
          acc.push({ vendedor: seller?.name || 'Desconhecido', vendas: 1, total: parseFloat(sale.total) });
        }
        return acc;
      }, [] as any[]).sort((a, b) => b.total - a.total);
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sellerPerformance), "Performance Vendedores");

      // Sheet 3: Produtos Mais Vendidos
      const topProducts = sales
        .flatMap(s => s.items)
        .reduce((acc, item) => {
          const existing = acc.find(p => p.productId === item.productId);
          const product = products.find(p => p.id === item.productId);
          if (existing) {
            existing.quantidade += item.quantity;
          } else {
            acc.push({ produto: product?.name || 'Desconhecido', quantidade: item.quantity, preco: item.priceAtSale, productId: item.productId });
          }
          return acc;
        }, [] as any[])
        .map(p => ({ 'Produto': p.produto, 'Quantidade': p.quantidade, 'Preço': p.preco }))
        .sort((a, b) => b.Quantidade - a.Quantidade);
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(topProducts), "Top Produtos");

      XLSX.writeFile(workbook, `relatorio_vendas_${format(new Date(), 'dd-MM-yyyy')}.xlsx`);
      toast({ title: "Sucesso", description: "Relatório exportado com sucesso!" });
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao exportar relatório", variant: "destructive" });
    }
  };

  const isSeller = user?.role === 'seller';
  const baseSales = isSeller ? sales.filter(s => s.userId === user?.id) : sales;

  const today = new Date();
  const todaySales = baseSales.filter(s => isSameDay(new Date(s.createdAt), today));
  const yesterdaySales = baseSales.filter(s => isSameDay(new Date(s.createdAt), subDays(today, 1)));
  const todayTotal = todaySales.reduce((acc, s) => acc + parseFloat(s.total), 0);
  const yesterdayTotal = yesterdaySales.reduce((acc, s) => acc + parseFloat(s.total), 0);

  const filteredSales = baseSales.filter(s => {
    if (!date?.from) return true;
    const saleDate = new Date(s.createdAt);
    const toDate = date.to || date.from;
    return saleDate >= date.from && saleDate <= toDate;
  });

  const salesByDate = filteredSales.reduce((acc, sale) => {
    const dateStr = format(new Date(sale.createdAt), 'dd/MM', { locale: ptBR });
    if (!acc[dateStr]) {
      acc[dateStr] = 0;
    }
    acc[dateStr] += parseFloat(sale.total);
    return acc;
  }, {} as Record<string, number>);

  const timeChartData = Object.entries(salesByDate).map(([date, total]) => ({
    date,
    total
  })).sort((a, b) => {
    return 0; 
  });

  const salesByCategory = filteredSales.reduce((acc, sale) => {
    sale.items.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      if (product) {
        const category = categories.find(c => c.id === product.categoryId);
        const catName = category ? category.name : 'Outros';
        if (!acc[catName]) acc[catName] = 0;
        acc[catName] += item.priceAtSale * item.quantity;
      }
    });
    return acc;
  }, {} as Record<string, number>);

  const categoryChartData = Object.entries(salesByCategory).map(([name, value]) => ({
    name,
    value
  }));

  const totalRevenue = filteredSales.reduce((acc, curr) => acc + parseFloat(curr.total), 0);
  const averageTicket = filteredSales.length > 0 ? totalRevenue / filteredSales.length : 0;

  // Performance por Vendedor
  const sellerPerformance = sales.reduce((acc, sale) => {
    const seller = users.find(u => u.id === sale.userId);
    const existing = acc.find(s => s.id === sale.userId);
    if (existing) {
      existing.vendas += 1;
      existing.total += parseFloat(sale.total);
    } else {
      acc.push({ id: sale.userId, nome: seller?.name || 'Desconhecido', vendas: 1, total: parseFloat(sale.total) });
    }
    return acc;
  }, [] as any[])
    .map(s => ({ ...s, percentual: ((s.total / (sales.reduce((a, c) => a + parseFloat(c.total), 0) || 1)) * 100).toFixed(1) }))
    .sort((a, b) => b.total - a.total);

  const isLoading = salesLoading || productsLoading || categoriesLoading || usersLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-muted-foreground">Carregando relatórios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* MOBILE: Resumo do vendedor — hoje e ontem */}
      <div className="md:hidden space-y-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Minhas Vendas</h1>
          <p className="text-sm text-muted-foreground">Resumo do seu desempenho</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-4 text-white shadow-md">
            <div className="flex items-center gap-2 mb-2 opacity-90">
              <Clock className="h-4 w-4" />
              <span className="text-xs font-medium">Hoje</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(todayTotal)}</p>
            <p className="text-xs opacity-80 mt-1">{todaySales.length} {todaySales.length === 1 ? 'venda' : 'vendas'}</p>
          </div>
          <div className="bg-gradient-to-br from-orange-400 to-orange-500 rounded-2xl p-4 text-white shadow-md">
            <div className="flex items-center gap-2 mb-2 opacity-90">
              <TrendingDown className="h-4 w-4" />
              <span className="text-xs font-medium">Ontem</span>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(yesterdayTotal)}</p>
            <p className="text-xs opacity-80 mt-1">{yesterdaySales.length} {yesterdaySales.length === 1 ? 'venda' : 'vendas'}</p>
          </div>
        </div>

        {/* Lista de vendas recentes (mobile) */}
        <div className="bg-card border rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30">
            <p className="font-semibold text-sm flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-primary" />
              Vendas Recentes
            </p>
          </div>
          <div className="divide-y">
            {baseSales.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm">Nenhuma venda registada</div>
            ) : (
              baseSales
                .slice()
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 10)
                .map(sale => {
                  const isToday = isSameDay(new Date(sale.createdAt), today);
                  const isYesterday = isSameDay(new Date(sale.createdAt), subDays(today, 1));
                  const dayLabel = isToday ? 'Hoje' : isYesterday ? 'Ontem' : format(new Date(sale.createdAt), "dd/MM", { locale: ptBR });
                  return (
                    <div key={sale.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium">#{sale.id.slice(-6).toUpperCase()}</p>
                        <p className="text-xs text-muted-foreground">
                          {dayLabel} · {format(new Date(sale.createdAt), "HH:mm")} · {sale.items.length} {sale.items.length === 1 ? 'item' : 'itens'}
                        </p>
                      </div>
                      <span className="font-bold text-primary">{formatCurrency(parseFloat(sale.total))}</span>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </div>

      {/* DESKTOP: cabeçalho normal */}
      <div className="hidden md:flex md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground">Análise detalhada de vendas e desempenho.</p>
        </div>
        <div className="flex flex-col md:flex-row gap-2">
          <Button onClick={handleExportExcel} variant="outline" className="gap-2 rounded-xl w-full md:w-auto">
            <Download className="h-4 w-4" />
            Exportar Excel
          </Button>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                id="date"
                variant={"outline"}
                className={cn(
                  "w-full md:w-[300px] justify-start text-left font-normal rounded-xl",
                  !date && "text-muted-foreground"
                )}
                data-testid="button-date-range"
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {date?.from ? (
                  date.to ? (
                    <>
                      {format(date.from, "dd 'de' MMM", { locale: ptBR })} -{" "}
                      {format(date.to, "dd 'de' MMM", { locale: ptBR })}
                    </>
                  ) : (
                    format(date.from, "LLL dd, y")
                  )
                ) : (
                  <span>Selecione um período</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                initialFocus
                mode="range"
                defaultMonth={date?.from}
                selected={date}
                onSelect={setDate}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="hidden md:grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Receita Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary" data-testid="text-total-revenue">{formatCurrency(totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">No período selecionado</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vendas Realizadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-sales">{filteredSales.length}</div>
            <p className="text-xs text-muted-foreground">Transações</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ticket Médio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-ticket">{formatCurrency(averageTicket)}</div>
            <p className="text-xs text-muted-foreground">Por venda</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="graficos" className="hidden md:block space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="graficos">Gráficos</TabsTrigger>
          <TabsTrigger value="vendedores" className="gap-1"><Users className="h-4 w-4" /> Performance</TabsTrigger>
          <TabsTrigger value="tendencias" className="gap-1"><TrendingUp className="h-4 w-4" /> Tendências</TabsTrigger>
        </TabsList>

        <TabsContent value="graficos" className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Evolução de Vendas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeChartData}>
                   <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(150 60% 35%)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="hsl(150 60% 35%)" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `MT ${val}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                    formatter={(val: number) => formatCurrency(val)}
                  />
                  <Area type="monotone" dataKey="total" stroke="hsl(150 60% 35%)" fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Vendas por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryChartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} width={100} />
                  <Tooltip 
                    cursor={{fill: 'transparent'}}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                    formatter={(val: number) => formatCurrency(val)}
                  />
                  <Bar dataKey="value" fill="hsl(32 95% 55%)" radius={[0, 4, 4, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
        </TabsContent>

        <TabsContent value="vendedores" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ranking de Vendedores</CardTitle>
              <CardDescription>Performance de vendas por vendedor</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {sellerPerformance.map((seller, idx) => (
                  <div key={seller.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg border border-primary/20">
                    <div className="flex items-center gap-4 flex-1">
                      <div className="font-bold text-2xl text-primary/60">#{idx + 1}</div>
                      <div>
                        <p className="font-semibold text-gray-800">{seller.nome}</p>
                        <p className="text-sm text-muted-foreground">{seller.vendas} vendas realizadas</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">{formatCurrency(seller.total)}</p>
                      <p className="text-xs text-muted-foreground">{seller.percentual}% do total</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Distribuição de Vendas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sellerPerformance}
                      dataKey="total"
                      nameKey="nome"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({nome, percentual}) => `${nome} (${percentual}%)`}
                      colors={['#10b981', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6']}
                    />
                    <Tooltip formatter={(val) => formatCurrency(val)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tendencias" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Análise de Tendências</CardTitle>
              <CardDescription>Evolução de vendas e recomendações</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm font-semibold text-green-800">Tendência de Crescimento</p>
                  <p className="text-2xl font-bold text-green-600 mt-2">+12.5%</p>
                  <p className="text-xs text-muted-foreground mt-1">Comparado ao período anterior</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm font-semibold text-blue-800">Melhor Dia</p>
                  <p className="text-2xl font-bold text-blue-600 mt-2">{formatCurrency(Math.max(...Object.values(salesByDate) as number[]) || 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Receita máxima no período</p>
                </div>
              </div>

              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="font-semibold text-yellow-800 mb-3">💡 Recomendações de Reordenação</p>
                <ul className="space-y-2 text-sm">
                  {products
                    .filter(p => parseFloat(p.stock) <= parseFloat(p.minStock) * 1.5)
                    .sort((a, b) => parseFloat(a.stock) - parseFloat(b.stock))
                    .slice(0, 5)
                    .map(p => (
                      <li key={p.id} className="flex justify-between items-center p-2 bg-white rounded border border-yellow-100">
                        <span className="text-gray-700">{p.name}</span>
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded font-semibold">
                          {parseFloat(p.stock)} / {parseFloat(p.minStock)} {p.unit}
                        </span>
                      </li>
                    ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
