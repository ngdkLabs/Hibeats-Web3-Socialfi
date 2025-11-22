import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import SongHistory from "@/components/SongHistory";

const SongHistoryPage = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="page-main">
        <div className="page-shell py-6">
          <SongHistory />
        </div>
      </main>
    </div>
  );
};

export default SongHistoryPage;