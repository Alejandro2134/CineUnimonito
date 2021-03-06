const express = require('express');
const router =  express.Router();
const connection = require('../database');

const { isLoggedIn } = require('../lib/auth');

router.get('/', async (req, res) => {
    const multiplexList = await connection.query('SELECT nombreMultiplex, idMultiplex FROM multiplex');
    res.render('multiplex/multiplexList', { multiplexList });
})

router.get('/:idMultiplex', (req, res) => {

    const { idMultiplex } = req.params; 
    res.render('multiplex/multiplexHome', { idMultiplex });

})

router.get('/:idMultiplex/peliculas', async (req, res) => {
    const { idMultiplex } = req.params;
    const peliculas = await connection.query('SELECT portada, nombrePelicula, idPelicula, Multiplex_idMultiplex FROM pelicula WHERE Multiplex_idMultiplex = ?', [idMultiplex]);
    res.render('multiplex/peliculas', { peliculas });
})

router.get('/:idMultiplex/peliculas/:idPelicula', async (req, res) => {

    const { idPelicula } = req.params;
    const url = req.originalUrl;

    const query = await connection.query('SELECT * FROM pelicula WHERE idPelicula = ?', [idPelicula]);
    const query2 = await connection.query('SELECT * FROM funcion WHERE Pelicula_idPelicula = ?', [idPelicula]);

    Promise.all([
        query[0],
        query2,
        url
    ])
    .then(([pelicula, funciones, url]) => {
        res.render('multiplex/pelicula', {
            pelicula,
            funciones,
            url
        });
    });  
})

router.get('/:idMultiplex/peliculas/:idPelicula/reserva/:idFuncion', isLoggedIn, async (req, res) => {

    const asientos = await connection.query('SELECT idAsiento, disponibilidad FROM asiento WHERE Sala_idSala = "1"');
    res.render('multiplex/reserva', { asientos });

});

router.post('/:idMultiplex/peliculas/:idPelicula/reserva/:idFuncion', async (req, res) => {

    const { asiento } = req.body;
    const { idMultiplex, idPelicula, idFuncion } = req.params;

    connection.beginTransaction(async err => {

        if (err) { throw err; };

        const infoAsiento = await connection.query('SELECT disponibilidad, idCliente FROM asiento WHERE idAsiento = ?', asiento);

        if(infoAsiento[0].disponibilidad == 0) {

            connection.query('UPDATE asiento SET disponibilidad = "1", idCliente = ? WHERE idAsiento = ?', [req.user.idCliente, asiento], async err => {

                if(err) {
                    return connection.rollback(() => {
                        throw err;
                    })
                }
    
                const fechaFuncion = await connection.query('SELECT fechaFuncion FROM funcion WHERE idFuncion = ?', idFuncion);
            
                const newReservation = {
                    Cliente_idCliente: req.user.idCliente,
                    fechaFuncion: fechaFuncion[0].fechaFuncion,
                    Funcion_idFuncion: idFuncion,
                    Asiento_idAsiento: asiento
                }
    
                connection.query('INSERT INTO reserva SET ?', newReservation, err => {
    
                    if(err) {
                        return connection.rollback(() => {
                            throw err;
                        })
                    }
    
                    const newTicket = {
                        Cliente_idCliente: req.user.idCliente,
                        Funcion_idFuncion: idFuncion,
                        Asiento_idAsiento: asiento
                    }
    
                    connection.query('INSERT INTO ticket SET ?', newTicket, err => {
    
                        if(err) {
                            return connection.rollback(() => {
                                throw err;
                            })
                        }
    
                        connection.commit((err) => {
    
                            if(err) {
                                return connection.rollback(() => {
                                    throw err;
                                })
                            }
    
                        })
                    })
                })
            })
        } else {
            
            if(infoAsiento[0].idCliente == req.user.idCliente) {

                connection.query('UPDATE asiento SET disponibilidad = "0", idCliente = "0" WHERE idAsiento = ?', asiento, err => {

                    if(err) {
                        return connection.rollback(() => {
                            throw err;
                        })
                    }

                    connection.query('DELETE FROM reserva WHERE Asiento_idAsiento = ?', asiento, err => {

                        if(err) {
                            return connection.rollback(() => {
                                throw err;
                            })
                        }

                        connection.query('DELETE FROM ticket WHERE Asiento_idAsiento = ?', asiento, err => {

                            if(err) {
                                return connection.rollback(() => {
                                    throw err;
                                })
                            }

                            connection.commit((err) => {
    
                                if(err) {
                                    return connection.rollback(() => {
                                        throw err;
                                    })
                                }
        
                            })

                        })

                    })

                })

            } else {
                return connection.rollback(() => {
                    console.log("No se puede modificar esta reserva");
                })
            }

        } 
    });

    res.redirect('/multiplex/' + idMultiplex + '/peliculas/' + idPelicula + '/reserva/' + idFuncion);
})

module.exports = router;