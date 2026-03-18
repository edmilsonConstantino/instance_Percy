import { useAuth } from '@/lib/auth';
import { useState, useRef } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, FileDown, FileUp, AlertTriangle, Pencil, Trash2, AlertCircle, ArrowUp, Camera } from 'lucide-react';
import { BarcodeCameraScan } from '@/components/BarcodeCameraScan';
import { formatCurrency } from '@/lib/utils';
import { Product, productsApi, categoriesApi, systemApi } from '@/lib/api';
import * as XLSX from 'xlsx';
import { toast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function Products() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', color: 'bg-blue-100 text-blue-800' });

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['/api/products'],
    queryFn: productsApi.getAll
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['/api/categories'],
    queryFn: categoriesApi.getAll
  });

  const { data: editCount } = useQuery({
    queryKey: ['/api/system/edit-count'],
    queryFn: systemApi.getEditCount
  });

  const [newProduct, setNewProduct] = useState({
    name: '',
    sku: '',
    barcode: '',
    price: '',
    costPrice: '',
    stock: '',
    unit: 'un' as 'un' | 'kg' | 'g' | 'pack' | 'box',
    categoryId: '',
    minStock: '5',
    image: '',
  });

  const createProductMutation = useMutation({
    mutationFn: productsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/system/edit-count'] });
      setIsAddOpen(false);
      setNewProduct({ name: '', sku: '', barcode: '', price: '', costPrice: '', stock: '', unit: 'un', categoryId: '', minStock: '5', image: '' });
      toast({ title: "Sucesso", description: "Produto cadastrado!" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => productsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/system/edit-count'] });
      toast({ title: "Sucesso", description: "Produto atualizado!" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const deleteProductMutation = useMutation({
    mutationFn: productsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({ title: "Sucesso", description: "Produto deletado!" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const [increaseStockOpen, setIncreaseStockOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [increaseQuantity, setIncreaseQuantity] = useState('');
  const [increasePrice, setIncreasePrice] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [barcodeScanOpen, setBarcodeScanOpen] = useState<'add' | 'edit' | null>(null);

  const increaseStockMutation = useMutation({
    mutationFn: ({ id, quantity, price }: { id: string; quantity: number; price?: number }) => 
      productsApi.increaseStock(id, quantity, price),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      setIncreaseStockOpen(false);
      setIncreaseQuantity('');
      setIncreasePrice('');
      toast({ title: "Sucesso", description: "Estoque e preço atualizados!" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const createCategoryMutation = useMutation({
    mutationFn: categoriesApi.create,
    onSuccess: (createdCategory) => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      setNewProduct({...newProduct, categoryId: createdCategory.id});
      setIsCategoryDialogOpen(false);
      setNewCategory({ name: '', color: 'bg-blue-100 text-blue-800' });
      toast({ title: "Sucesso", description: "Categoria criada!" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const handleExport = () => {
    const exportData = products.map(p => ({
      Nome: p.name,
      SKU: p.sku,
      Preço: parseFloat(p.price),
      Custo: parseFloat(p.costPrice),
      Estoque: parseFloat(p.stock),
      Minimo: parseFloat(p.minStock),
      Unidade: p.unit,
      Categoria: categories.find(c => c.id === p.categoryId)?.name || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produtos");
    XLSX.writeFile(wb, "produtos.xlsx");
    toast({ title: "Sucesso", description: "Produtos exportados com sucesso!" });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];
      
      data.forEach((row: any) => {
        const categoryId = categories.find(c => c.name === row.Categoria)?.id || categories[0]?.id || null;
        
        createProductMutation.mutate({
          name: row.Nome || row.name || 'Produto Importado',
          sku: row.SKU || row.sku || `IMP-${Date.now()}`,
          price: String(row.Preço || row.price || 0),
          costPrice: String(row.Custo || row.costPrice || 0),
          stock: String(row.Estoque || row.stock || 0),
          minStock: String(row.Minimo || row.minStock || 5),
          unit: (row.Unidade || row.unit || 'un') as any,
          categoryId,
          image: ''
        });
      });

      toast({ title: "Sucesso", description: `Importando ${data.length} produtos...` });
    };
    reader.readAsBinaryString(file);
  };

  const handleSaveProduct = () => {
    if (!newProduct.name || !newProduct.price) {
      toast({ 
        title: "Erro", 
        description: "Nome e preço são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    if (editCount && !editCount.canEdit) {
      toast({ 
        title: "Limite atingido", 
        description: `Você atingiu o limite de ${editCount.limit} edições diárias`,
        variant: "destructive"
      });
      return;
    }
    
    createProductMutation.mutate({
      name: newProduct.name,
      sku: newProduct.sku || newProduct.barcode || `SKU-${Date.now()}`,
      categoryId: newProduct.categoryId || categories[0]?.id || null,
      price: newProduct.price,
      costPrice: newProduct.costPrice || '0',
      stock: newProduct.stock || '0',
      minStock: newProduct.minStock || '5',
      unit: newProduct.unit,
      image: newProduct.image || ''
    });
  };

  const handleDeleteProduct = (id: string) => {
    if (confirm('Tem certeza que deseja deletar este produto?')) {
      deleteProductMutation.mutate(id);
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setIsEditOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingProduct || !editingProduct.name || !editingProduct.price) {
      toast({ 
        title: "Erro", 
        description: "Nome e preço são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    if (editCount && !editCount.canEdit) {
      toast({ 
        title: "Limite atingido", 
        description: `Você atingiu o limite de ${editCount.limit} edições diárias`,
        variant: "destructive"
      });
      return;
    }

    updateProductMutation.mutate({
      id: editingProduct.id,
      data: {
        name: editingProduct.name,
        sku: editingProduct.sku || (editingProduct as any).barcode || `SKU-${Date.now()}`,
        price: editingProduct.price,
        costPrice: editingProduct.costPrice,
        stock: editingProduct.stock,
        minStock: editingProduct.minStock,
        unit: editingProduct.unit,
        categoryId: editingProduct.categoryId,
        image: editingProduct.image
      }
    });
    setIsEditOpen(false);
  };

  if (productsLoading || categoriesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-muted-foreground">Carregando produtos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Produtos</h1>
          <p className="text-muted-foreground">Gerencie seu estoque e catálogo.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".xlsx,.xls" />
          <Button variant="outline" onClick={handleImportClick} className="flex-1 sm:flex-none rounded-xl" data-testid="button-import">
            <FileUp className="mr-2 h-4 w-4" />
            Importar
          </Button>
          <Button variant="outline" onClick={handleExport} className="flex-1 sm:flex-none rounded-xl" data-testid="button-export">
            <FileDown className="mr-2 h-4 w-4" />
            Exportar
          </Button>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto rounded-xl shadow-lg shadow-primary/20" data-testid="button-add-product">
                <Plus className="mr-2 h-4 w-4" />
                Novo Produto
              </Button>
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Adicionar Produto</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {editCount && !editCount.canEdit && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Você atingiu o limite de {editCount.limit} edições diárias. Você já fez {editCount.count} edições hoje.
                    </AlertDescription>
                  </Alert>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Nome do Produto</Label>
                    <Input
                      value={newProduct.name}
                      onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                      data-testid="input-product-name"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Código (SKU)</Label>
                    <Input
                      value={newProduct.sku}
                      onChange={e => setNewProduct({...newProduct, sku: e.target.value})}
                      placeholder="Gerado automaticamente se vazio"
                      data-testid="input-product-sku"
                    />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Código de Barras (opcional — escanear ou digitar)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={newProduct.barcode}
                      onChange={e => setNewProduct({...newProduct, barcode: e.target.value})}
                      placeholder="EAN-13, UPC — ou use o botão para escanear"
                      data-testid="input-product-barcode"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setBarcodeScanOpen('add')}
                      title="Escanear código de barras"
                    >
                      <Camera className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Pode registar barcode, SKU ou ambos. Se vazio, o sistema gera automaticamente — ambos servem para venda com scanner.</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label>Preço Venda (MT)</Label>
                    <Input
                      type="number"
                      value={newProduct.price}
                      onChange={e => setNewProduct({...newProduct, price: e.target.value})}
                      data-testid="input-product-price"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Preço Custo (MT)</Label>
                    <Input
                      type="number"
                      value={newProduct.costPrice}
                      onChange={e => setNewProduct({...newProduct, costPrice: e.target.value})}
                      data-testid="input-product-cost"
                    />
                  </div>
                  <div className="grid gap-2 col-span-2 sm:col-span-1">
                    <Label>Unidade</Label>
                    <Select
                      value={newProduct.unit}
                      onValueChange={(val: any) => setNewProduct({...newProduct, unit: val})}
                    >
                      <SelectTrigger data-testid="select-product-unit">
                        <SelectValue placeholder="Unidade" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="un">Unidade (un)</SelectItem>
                        <SelectItem value="kg">Quilograma (kg)</SelectItem>
                        <SelectItem value="g">Grama (g)</SelectItem>
                        <SelectItem value="pack">Pacote</SelectItem>
                        <SelectItem value="box">Caixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label>Estoque Inicial</Label>
                    <Input
                      type="number"
                      value={newProduct.stock}
                      onChange={e => setNewProduct({...newProduct, stock: e.target.value})}
                      data-testid="input-product-stock"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Estoque Mínimo (Alerta)</Label>
                    <Input
                      type="number"
                      value={newProduct.minStock}
                      onChange={e => setNewProduct({...newProduct, minStock: e.target.value})}
                      data-testid="input-product-minstock"
                    />
                  </div>
                  <div className="grid gap-2 col-span-2 sm:col-span-1">
                    <Label>Categoria</Label>
                    <div className="flex gap-2">
                      <Select 
                        value={newProduct.categoryId} 
                        onValueChange={(val) => setNewProduct({...newProduct, categoryId: val})}
                      >
                        <SelectTrigger data-testid="select-product-category" className="flex-1">
                          <SelectValue placeholder="Categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map(cat => (
                            <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="icon" type="button">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                          <DialogHeader>
                            <DialogTitle>Nova Categoria</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label>Nome da Categoria</Label>
                              <Input 
                                value={newCategory.name}
                                onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                                placeholder="Ex: Bebidas, Limpeza..."
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Cor da Categoria</Label>
                              <Select 
                                value={newCategory.color}
                                onValueChange={(val) => setNewCategory({...newCategory, color: val})}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="bg-blue-100 text-blue-800">Azul</SelectItem>
                                  <SelectItem value="bg-green-100 text-green-800">Verde</SelectItem>
                                  <SelectItem value="bg-yellow-100 text-yellow-800">Amarelo</SelectItem>
                                  <SelectItem value="bg-red-100 text-red-800">Vermelho</SelectItem>
                                  <SelectItem value="bg-purple-100 text-purple-800">Roxo</SelectItem>
                                  <SelectItem value="bg-orange-100 text-orange-800">Laranja</SelectItem>
                                  <SelectItem value="bg-pink-100 text-pink-800">Rosa</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <Button 
                            onClick={() => createCategoryMutation.mutate(newCategory)}
                            disabled={!newCategory.name || createCategoryMutation.isPending}
                          >
                            {createCategoryMutation.isPending ? 'Criando...' : 'Criar Categoria'}
                          </Button>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label>URL da Imagem (Opcional)</Label>
                  <Input 
                    value={newProduct.image} 
                    onChange={e => setNewProduct({...newProduct, image: e.target.value})}
                    placeholder="https://exemplo.com/imagem.jpg"
                    data-testid="input-product-image"
                  />
                  <p className="text-xs text-muted-foreground">
                    Se não adicionar uma imagem, será exibida a primeira letra do nome do produto.
                  </p>
                </div>
              </div>
              <Button 
                onClick={handleSaveProduct} 
                disabled={createProductMutation.isPending || (editCount && !editCount.canEdit)}
                data-testid="button-save-product"
              >
                {createProductMutation.isPending ? 'Salvando...' : 'Salvar Produto'}
              </Button>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {editCount && editCount.count > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Você fez {editCount.count} de {editCount.limit} edições permitidas hoje.
            {!editCount.canEdit && ' Limite atingido!'}
          </AlertDescription>
        </Alert>
      )}

      {/* Modal de Edição de Produtos */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Produto</DialogTitle>
          </DialogHeader>
          {editingProduct && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Nome do Produto</Label>
                  <Input 
                    value={editingProduct.name} 
                    onChange={e => setEditingProduct({...editingProduct, name: e.target.value})}
                    data-testid="input-edit-product-name"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Código (SKU)</Label>
                  <Input
                    value={editingProduct.sku}
                    onChange={e => setEditingProduct({...editingProduct, sku: e.target.value})}
                    data-testid="input-edit-product-sku"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Código de Barras (opcional — escanear ou digitar)</Label>
                <div className="flex gap-2">
                  <Input
                    value={(editingProduct as any).barcode || ''}
                    onChange={e => setEditingProduct({...editingProduct, barcode: e.target.value} as any)}
                    placeholder="EAN-13, UPC — ou use o botão para escanear"
                    data-testid="input-edit-product-barcode"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setBarcodeScanOpen('edit')}
                    title="Escanear código de barras"
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Pode registar barcode, SKU ou ambos — ambos servem para venda com scanner.</p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label>Preço Venda (MT)</Label>
                  <Input 
                    type="number" 
                    value={editingProduct.price} 
                    onChange={e => setEditingProduct({...editingProduct, price: e.target.value})}
                    data-testid="input-edit-product-price"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Preço Custo (MT)</Label>
                  <Input 
                    type="number" 
                    value={editingProduct.costPrice} 
                    onChange={e => setEditingProduct({...editingProduct, costPrice: e.target.value})}
                    data-testid="input-edit-product-cost"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Estoque</Label>
                  <Input 
                    type="number" 
                    value={editingProduct.stock} 
                    onChange={e => setEditingProduct({...editingProduct, stock: e.target.value})}
                    data-testid="input-edit-product-stock"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Estoque Mínimo</Label>
                  <Input 
                    type="number" 
                    value={editingProduct.minStock} 
                    onChange={e => setEditingProduct({...editingProduct, minStock: e.target.value})}
                    data-testid="input-edit-product-minstock"
                  />
                </div>
                <div className="grid gap-2">
                  <Label>Unidade</Label>
                  <Select value={editingProduct.unit} onValueChange={(val) => setEditingProduct({...editingProduct, unit: val as any})}>
                    <SelectTrigger data-testid="select-edit-product-unit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="un">Un (Unidade)</SelectItem>
                      <SelectItem value="kg">Kg (Quilograma)</SelectItem>
                      <SelectItem value="g">g (Grama)</SelectItem>
                      <SelectItem value="pack">Pack</SelectItem>
                      <SelectItem value="box">Box</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Categoria</Label>
                <Select 
                  value={editingProduct.categoryId || ''} 
                  onValueChange={(val) => setEditingProduct({...editingProduct, categoryId: val})}
                >
                  <SelectTrigger data-testid="select-edit-product-category">
                    <SelectValue placeholder="Selecione categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>URL da Imagem (Opcional)</Label>
                <Input 
                  value={editingProduct.image || ''} 
                  onChange={e => setEditingProduct({...editingProduct, image: e.target.value})}
                  placeholder="https://exemplo.com/imagem.jpg"
                  data-testid="input-edit-product-image"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
            <Button 
              onClick={handleSaveEdit}
              disabled={updateProductMutation.isPending}
              data-testid="button-save-edit-product"
            >
              {updateProductMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border-primary/10">
        <CardHeader className="pb-2">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Filtrar produtos..." 
              className="pl-9" 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-products"
            />
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-6 px-6">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Estoque</TableHead>
                <TableHead>Unidade</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => {
                const category = categories.find(c => c.id === product.categoryId);
                const parsedStock = parseFloat(product.stock);
                const parsedMinStock = parseFloat(product.minStock);

                return (
                  <TableRow key={product.id} data-testid={`row-product-${product.id}`}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-3">
                        {product.image ? (
                          <img 
                            src={product.image} 
                            alt={product.name}
                            className="h-10 w-10 rounded-lg object-cover border border-border"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm border border-border">
                            {product.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {parsedStock <= parsedMinStock && (
                              <AlertTriangle className="h-4 w-4 text-destructive" />
                            )}
                            {product.name}
                          </div>
                          <div className="text-xs text-muted-foreground">{product.sku}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={category?.color}>
                        {category?.name || 'Geral'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{formatCurrency(parseFloat(product.price))}</span>
                        <span className="text-[10px] text-muted-foreground">Custo: {formatCurrency(parseFloat(product.costPrice))}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={parsedStock <= parsedMinStock ? "text-destructive font-bold" : ""}>
                        {parsedStock}
                      </span>
                    </TableCell>
                    <TableCell className="uppercase">{product.unit}</TableCell>
                    <TableCell className="text-right flex gap-2 justify-end">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => handleEditProduct(product)}
                        data-testid={`button-edit-${product.id}`}
                      >
                        <Pencil className="h-4 w-4 text-amber-600" />
                      </Button>
                      <Dialog open={increaseStockOpen && selectedProductId === product.id} onOpenChange={(open) => { setIncreaseStockOpen(open); if (!open) setSelectedProductId(''); }}>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8"
                          onClick={() => { setSelectedProductId(product.id); setIncreaseStockOpen(true); }}
                          data-testid={`button-increase-stock-${product.id}`}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Aumentar Estoque: {product.name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="grid gap-2">
                              <Label>Quantidade a Adicionar</Label>
                              <Input 
                                type="number" 
                                placeholder="Ex: 10"
                                value={increaseQuantity}
                                onChange={(e) => setIncreaseQuantity(e.target.value)}
                                data-testid="input-increase-quantity"
                              />
                              <p className="text-xs text-muted-foreground">
                                Estoque atual: {parsedStock} {product.unit}
                              </p>
                            </div>
                            <div className="grid gap-2">
                              <Label>Novo Preço (Opcional)</Label>
                              <Input 
                                type="number" 
                                step="0.01"
                                placeholder={formatCurrency(parseFloat(product.price))}
                                value={increasePrice}
                                onChange={(e) => setIncreasePrice(e.target.value)}
                                data-testid="input-increase-price"
                              />
                              <p className="text-xs text-muted-foreground">
                                Preço atual: {formatCurrency(parseFloat(product.price))}
                              </p>
                            </div>
                            <Button 
                              onClick={() => increaseStockMutation.mutate({ 
                                id: product.id, 
                                quantity: parseFloat(increaseQuantity),
                                price: increasePrice ? parseFloat(increasePrice) : undefined
                              })}
                              disabled={increaseStockMutation.isPending || !increaseQuantity}
                              className="w-full"
                              data-testid="button-save-increase-stock"
                            >
                              {increaseStockMutation.isPending ? 'Atualizando...' : 'Aumentar Estoque'}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteProduct(product.id)}
                        disabled={deleteProductMutation.isPending}
                        data-testid={`button-delete-${product.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!barcodeScanOpen} onOpenChange={(o) => !o && setBarcodeScanOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ler código de barras</DialogTitle>
          </DialogHeader>
          <BarcodeCameraScan
            id="products-barcode-scan"
            onScan={(code) => {
              if (barcodeScanOpen === 'add') {
                setNewProduct(p => ({ ...p, barcode: code, sku: p.sku || code }));
              } else if (barcodeScanOpen === 'edit' && editingProduct) {
                setEditingProduct({ ...editingProduct, barcode: code } as any);
              }
              setBarcodeScanOpen(null);
            }}
            onClose={() => setBarcodeScanOpen(null)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
