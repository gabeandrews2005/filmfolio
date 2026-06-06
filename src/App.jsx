import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { FilmProvider } from './context/FilmContext'
import Nav from './components/Nav'
import Home from './pages/Home'
import Movies from './pages/Movies'
import MyList from './pages/MyList'
import Recommendations from './pages/Recommendations'
import About from './pages/About'

export default function App() {
  return (
    <BrowserRouter>
      <FilmProvider>
        <Nav />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/movies" element={<Movies />} />
          <Route path="/my-list" element={<MyList />} />
          <Route path="/recommendations" element={<Recommendations />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </FilmProvider>
    </BrowserRouter>
  )
}
