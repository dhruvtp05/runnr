import Navbar from './components/Navbar';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-black">
      <Navbar />
      {/* The rest of your hero section starts here */}
      <main className="pt-32 px-8"> 
         {/* pt-32 ensures the content isn't hidden behind the fixed navbar */}
      </main>
    </div>
  );
}