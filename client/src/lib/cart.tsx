import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Product } from './api';

export interface CartItem {
  productId: string;
  quantity: number;
  priceAtSale: number;
}

interface CartContextType {
  cart: CartItem[];
  addToCart: (product: Product, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  getCartTotal: () => number;
}

const CART_STORAGE_KEY = 'pos_cart';

function loadCartFromStorage(): CartItem[] {
  try {
    const saved = localStorage.getItem(CART_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(loadCartFromStorage);

  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {}
  }, [cart]);

  const addToCart = (product: Product, quantity: number) => {
    const parsedStock = parseFloat(product.stock);
    if (parsedStock < quantity) {
      throw new Error(`Estoque insuficiente. Apenas ${parsedStock} ${product.unit} disponíveis.`);
    }

    setCart((prevCart) => {
      const existingItemIndex = prevCart.findIndex(item => item.productId === product.id);
      if (existingItemIndex > -1) {
        const newCart = [...prevCart];
        newCart[existingItemIndex].quantity += quantity;
        return newCart;
      }
      return [...prevCart, {
        productId: product.id,
        quantity,
        priceAtSale: parseFloat(product.price)
      }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prevCart) => prevCart.filter(item => item.productId !== productId));
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    setCart((prevCart) => prevCart.map(item =>
      item.productId === productId ? { ...item, quantity } : item
    ));
  };

  const clearCart = () => {
    setCart([]);
    try { localStorage.removeItem(CART_STORAGE_KEY); } catch {}
  };

  const getCartTotal = () => {
    return cart.reduce((sum, item) => sum + (item.priceAtSale * item.quantity), 0);
  };

  return (
    <CartContext.Provider value={{
      cart,
      addToCart,
      removeFromCart,
      updateCartQuantity,
      clearCart,
      getCartTotal
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
