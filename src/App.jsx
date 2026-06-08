import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { FilmProvider } from './context/FilmContext'
import { useFilm } from './context/FilmContext'
import Nav from './components/Nav'
import ProfileSetupModal from './components/ProfileSetupModal'
import Home from './pages/Home'
import Explore from './pages/Explore'
import MyList from './pages/MyList'
import Recommendations from './pages/Recommendations'
import Universe from './pages/Universe'
import Friends from './pages/Friends'
import Profile from './pages/Profile'
import About from './pages/About'
import SeenFilms from './pages/SeenFilms'
import Watchlist from './pages/Watchlist'
import Statistics from './pages/Statistics'
import GenreList from './pages/lists/GenreList'
import PersonList from './pages/lists/PersonList'
import ShowsList from './pages/lists/ShowsList'

function ProfileGate({ children }) {
  const { user, setUser } = useFilm()
  const [showModal, setShowModal] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!user && !sessionStorage.getItem('ff_profile_dismissed')) {
      const timer = setTimeout(() => setShowModal(true), 1500)
      return () => clearTimeout(timer)
    }
    setChecked(true)
  }, [user])

  function handleComplete(userData) {
    if (userData) setUser(userData)
    sessionStorage.setItem('ff_profile_dismissed', '1')
    setShowModal(false)
    setChecked(true)
  }

  return (
    <>
      {children}
      {showModal && <ProfileSetupModal onComplete={handleComplete} />}
    </>
  )
}

function AppRoutes() {
  return (
    <ProfileGate>
      <Nav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/movies" element={<Navigate to="/explore" replace />} />
        <Route path="/my-list" element={<MyList />} />
        <Route path="/recommendations" element={<Recommendations />} />
        <Route path="/universe" element={<Universe />} />
        <Route path="/friends" element={<Friends />} />
        <Route path="/profile/:username" element={<Profile />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/about" element={<About />} />
        <Route path="/seen" element={<SeenFilms />} />
        <Route path="/watchlist" element={<Watchlist />} />
        <Route path="/statistics" element={<Statistics />} />
        <Route
          path="/lists/horror"
          element={<GenreList listType="horror" title="Horror" maxItems={50} />}
        />
        <Route
          path="/lists/comedies"
          element={<GenreList listType="comedies" title="Comedies" maxItems={50} />}
        />
        <Route
          path="/lists/animated"
          element={<GenreList listType="animated" title="Animated" maxItems={50} />}
        />
        <Route
          path="/lists/seasonal"
          element={<GenreList listType="seasonal" title="Seasonal" maxItems={25} />}
        />
        <Route
          path="/lists/actors"
          element={<PersonList listType="actors" title="Actors" maxItems={50} />}
        />
        <Route
          path="/lists/directors"
          element={<PersonList listType="directors" title="Directors" maxItems={25} />}
        />
        <Route path="/lists/shows" element={<ShowsList />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ProfileGate>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <FilmProvider>
        <AppRoutes />
      </FilmProvider>
    </BrowserRouter>
  )
}
