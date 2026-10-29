require("dotenv").config();
const express = require("express");
const cors = require("cors");
const db = require("./db");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/transactions", (req, res) => {
    const { month } = req.query;

    const sql = `
        SELECT * FROM transactions WHERE month = ?
    `;

    db.query(sql, [month], (err, result) => {
        if(err){
            return res.status(500).json(err);
        }

        res.json(result);
    })
});

app.get("/budget/:month", (req, res) => {
    const { month } = req.params;

    const sql = `
        SELECT * FROM budgets WHERE month = ? 
    `;

    db.query(sql, [month], (err, result) => {
        if(err){
            return res.status(500).json(err);
        }

        if(result.length === 0){
           return res.json({amount: 0})
        }

        res.json(result[0]);
    })
})

app.post("/budget", (req, res) => {
    const { month, amount } = req.body;

    const updateSql = `
        UPDATE budgets SET amount = ? WHERE month = ?
    `;

    db.query(updateSql, [amount, month], (err, result) => {
        if(err){
            return res.status(500).json(err);
        }

        if (result.affectedRows === 0) {
            const insertSQL = `
                INSERT INTO budgets (month, amount) VALUES (?, ?)
            `

            return db.query(insertSQL, [month, amount], (err) => {
                if (err) {
                return res.status(500).json(err)
                }

                return res.json({ month, amount })
            })
        }

        return res.json({ month, amount })
    })
})

app.post("/transactions", (req, res) => {
    const {amount, category, checked, type, month} = req.body;

    const sql =`
        INSERT INTO transactions (amount, category, checked, type, month)
        VALUES (?, ?, ?, ?, ?)
    `;

    db.query(sql, [amount, category, checked, type, month], (err, result) => {
        if(err){
            console.log(err);
            res.status(500).send("DBエラー");
            return;
        }

        res.json({
            id: result.insertId,
            amount,
            category,
            checked,
            type,
            month
        })
    })
});

app.patch("/transactions/:id", (req, res) => {
    
    const id = Number(req.params.id);

    const updateSql = `
        UPDATE transactions SET checked = NOT checked WHERE id = ?
    `;

    db.query(updateSql, [id], (err) => {
        if(err){
            return res.status(500).json(err);
        }

        db.query(
            "SELECT * FROM transactions WHERE id = ?",
            [id],
            (err, results) => {
                if(err){
                    return res.status(500).json(err);
                }

               return res.json(results[0]);
            }
        )
    })

    
})

app.delete("/transactions", (req, res) => {
    const { month } = req.query

    if(
        typeof month !== "string" ||
        !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)
    ) {
        return res.status(400).json({
            message: "月をYYYY-MM形式で指定してください"
        })
    }

    const deleteSQL = `
        DELETE FROM transactions
        WHERE checked = 1 AND month = ?
    `

    db.query(deleteSQL, [month], (err) => {
        if(err) {
            return res.status(500).json({
                message: "支出の削除に失敗しました"
            })
        }

        const selectSQL = `
            SELECT * FROM transactions
            WHERE month = ?
        `

        db.query(selectSQL, [month], (err, result) => {
            if(err) {
                return res.status(500).json({
                    message: "削除後の支出取得に失敗しました"
                })
            }

            return res.json(result)
        })
    })
})

app.listen(PORT, () => {
    console.log("サーバー起動");
})