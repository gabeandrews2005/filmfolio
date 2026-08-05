import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { FilmProvider } from './context/FilmContext'
import Nav from './components/Nav'
import Home from './pages/Home'
import Explore from './pages/Explore'
import MyList from './pages/MyList'
import Recommendations from './pages/Recommendations'
import Universe from './pages/Universe'
import Friends from './pages/Friends'
import Profile from './pages/Profile'
import Account from './pages/Account'
import About from './pages/About'
import SeenFilms from './pages/SeenFilms'
import Watchlist from './pages/Watchlist'
import Statistics from './pages/Statistics'
import GenreList from './pages/lists/GenreList'
import PersonList from './pages/lists/PersonList'
import ShowsList from './pages/lists/ShowsList'

function AppRoutes() {
  return (
    <>
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
        <Route path="/account" element={<Account />} />
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
    </>
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
