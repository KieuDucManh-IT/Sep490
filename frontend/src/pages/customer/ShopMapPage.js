import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import Footer from '../../components/Footer';
import { useShopRadarData } from './shopMap/hooks/useShopRadarData';
import RadarControlsBar from './shopMap/components/RadarControlsBar';
import RadarSidebarList from './shopMap/components/RadarSidebarList';
import RadarMapCanvas from './shopMap/components/RadarMapCanvas';
import '../../styles/ShopMap.css';

export default function ShopMapPage() {
  const navigate = useNavigate();

  const {
    userLocation,
    locating,
    handleQuickGps,
    loading,
    processedShops,
    selectedRadius,
    setSelectedRadius,
    searchTerm,
    setSearchTerm,
    selectedStore,
    setSelectedStore,
  } = useShopRadarData();

  // Handle clicking a card in the sidebar
  const handleSelectStoreFromSidebar = useCallback(
    (store) => {
      setSelectedStore(store);
    },
    [setSelectedStore]
  );

  // Handle clicking a marker on the map
  const handleSelectStoreFromMarker = useCallback(
    (store) => {
      setSelectedStore(store);
      const cardEl = document.getElementById(`radar-shop-card-${store.id}`);
      if (cardEl) {
        cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    },
    [setSelectedStore]
  );

  // Handle viewing products in catalog
  const handleNavigateToProducts = useCallback(
    (shopId) => {
      navigate(`/catalog?shop=${shopId}`);
    },
    [navigate]
  );

  // Handle resetting filters in empty state
  const handleResetFilters = useCallback(() => {
    setSelectedRadius('ALL');
    setSearchTerm('');
  }, [setSelectedRadius, setSearchTerm]);

  return (
    <div className="shop-radar-page">
      <Navbar />

      <section className="radar-header-hero" aria-labelledby="radar-page-title">
        <h1 id="radar-page-title" className="radar-title">Danh Sách Cửa Hàng</h1>
      </section>

      <RadarControlsBar
        userLocation={userLocation}
        locating={locating}
        onQuickGps={handleQuickGps}
        selectedRadius={selectedRadius}
        onSelectRadius={setSelectedRadius}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onClearSearch={() => setSearchTerm('')}
      />

      <main className="radar-split-layout">
        <RadarSidebarList
          stores={processedShops}
          loading={loading}
          selectedStore={selectedStore}
          userLocation={userLocation}
          onSelectStore={handleSelectStoreFromSidebar}
          onNavigateToProducts={handleNavigateToProducts}
          onResetFilters={handleResetFilters}
        />

        <RadarMapCanvas
          stores={processedShops}
          selectedStore={selectedStore}
          userLocation={userLocation}
          onSelectStoreFromMarker={handleSelectStoreFromMarker}
        />
      </main>

      <Footer />
    </div>
  );
}
